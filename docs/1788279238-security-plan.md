# Security without accounts — brainstorm & recommendation

## Current auth model (as found in code)

- **API_KEY** (`x-api-key`): single shared secret in `config.mjs`, checked by `passport-headerapikey`. Lives in the mobile app binary → extractable, not a real secret. Effectively a soft gate / abuse throttle, not protection.
- **x-user-id** (`user-header` strategy): a `TripUser` ObjectId sent in a header. `TripUser` is just `{ name, avatar, restrictions }` — no credential, no secret. **A Mongo ObjectId is not a secret**: 12 bytes, partly predictable (timestamp + machine + counter), and stored unencrypted. Anyone who learns or guesses a TripUser `_id` can impersonate that user on every mutation endpoint.
- **Trip IDs** are raw Mongo ObjectIds in URLs (`/trips/:id`, `/trips/:tripId/stops`, ...). Enumerable.
- **Share links** (`routes/trips.mjs:52,60`): two mechanisms — a deprecated JWT, and `idEncoderService.mjs` (AES-256-GCM encrypted trip ID). The encrypted-ID path is the direction the codebase is already moving.
- **`isPrivate` + `verifyUser`** pattern already exists, but only applied in `routes/tripUsers.mjs`. Stops, trips, polls, goods, messages don't apply it consistently. Reads are mostly open.

## Threat model — what we actually need to stop

1. **Random internet actor** reading/modifying any trip (today: API_KEY is extractable, trip IDs enumerable → full read/write to any trip).
2. **Cross-user impersonation within a trip** (today: knowing a TripUser ObjectId = full mutation power as that user).
3. **Stale access** after someone leaves / is removed from a trip.
4. **Private-trip leakage** via share links that embed the bare trip ID.

## Key realization

"No account" does not mean "no credentials." Email/password is one kind of credential; a **capability token** is another, and it needs no signup. The token *is* the (trip-scoped) identity. This is the magic-link / capability model, and it fits a no-signup mobile app cleanly.

## Option levels

| Level | What changes | What it stops | Cost |
|-------|--------------|---------------|------|
| **0 — status quo** | nothing | nothing real | — |
| **1 — secret per TripUser token** | Add a random 256-bit `token` to `TripUser`, minted on join. Replace `x-user-id` with `x-user-token`. Lookup by token, not ObjectId. Tokens rotatable. | Impersonation (2), stale access (3) | Low: one field + one index + strategy swap |
| **2 — unguessable share IDs** | Stop exposing raw ObjectIds in links/URLs. Use existing `encodeId`/`decodeId` at the route edge to resolve trips. | Enumeration (1, read side) | Low: already built, just wire it in |
| **3 — join capabilities for private trips** | Private-trip share link carries a one-time/time-limited *join token* that lets a newcomer create a TripUser + be added to `users[]`. Public-trip link = read capability only. | Private-trip leakage (4) | Medium: new token type + join endpoint |
| **4 — short-lived sessions** | After presenting the long-lived TripUser token, issue a short-lived signed session token (the existing JWT infra). Pass that on requests, rotate the long-lived token rarely. | Replay window narrowing | Medium: reuse deprecated JWT path |

Levels 1 + 2 + 3 are the sweet spot for "no account but real security." Level 4 is optional hardening once 1-3 are in.

## Recommended target: Levels 1 + 2 + 3

### Level 1 — secret TripUser token
- `TripUser` gains `token: { type: String, index: true, unique: true, required: true }`, generated with `crypto.randomBytes(32).toString('base64url')` on creation (`tripUserService.mjs`).
- `user-header` strategy in `passportConfig.mjs` swaps from `x-user-id` → `x-user-token` and does `TripUser.findOne({ token })` instead of `findById`.
- A "rotate token" endpoint lets a user/owner refresh a compromised token.
- Migration: backfill a token onto every existing TripUser; clients move off `x-user-id`.

### Level 2 — encoded trip IDs on the edge
- Share links already use `encodeId` (`routes/trips.mjs:60`). Extend the same idea: routes accept an encoded trip identifier where today they take a raw ObjectId, decode at the top of the handler, then use the real ObjectId internally.
- Internal calls and DB refs keep raw ObjectIds; only the public boundary changes.
- Keeps raw ObjectIds out of URLs and links → not enumerable.

### Level 3 — join capabilities (private trips)
- Private trip share link = a signed/encrypted token that encodes `{ tripId, role: 'join', exp }`, not the trip ID itself.
- New `POST /trips/:encodedId/join` consumes the join token: validates it, creates a `TripUser` (with a Level-1 token), pushes onto `trip.users`, returns the new TripUser + token. One-time or short-lived.
- Public trip share link = encoded trip ID (read capability); the same join endpoint works without a join token (anyone may join a public trip, as today).

### Access-control uniformity (orthogonal but required)
- Extract the `isPrivate` gate already in `routes/tripUsers.mjs` into a shared helper (e.g. `requireMembership(trip, user)` in `validationService.mjs`) and apply it on every read/mutation across stops, trips, polls, goods, messages. Today it's inconsistent — that's a leak waiting to happen regardless of tokens.

## What stays the same
- No email, no password, no global account. Identity is still per-trip.
- TripUser remains `{ name, avatar, restrictions }` plus the new `token`.
- The mobile app keeps sending one header per request; it just becomes a secret token instead of a guessable ObjectId.

## Open questions to resolve before implementing
1. **Token transport**: keep it as a header (`x-user-token`) or move to `Authorization: Bearer`? Header is consistent with today; Bearer is more standard.
2. **Backfill**: generate tokens for existing TripUsers in a migration script, or lazily on first read?
3. **Join-token lifetime**: one-time use, or time-bounded (e.g. 7d)? Affects whether a link can be reshared.
4. **Scope of this work**: do Level 1+2+3 together, or land Level 1 (tokens) first as the highest-value, lowest-risk step and tackle 2/3 after?
