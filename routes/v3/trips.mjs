import express from "express";
import {
    getTrip,
    createTrip,
    deleteTrip,
    updateTrip,
    dashboard,
    batchHydrate,
} from "../../services/tripService.mjs";
import { createTripUsers, claimSeat, releaseSeat, addSeatsToTrip, switchSeat, getClaimedSeatIds } from "../../services/tripUserService.mjs";
import { generateJoinToken, verifyJoinToken } from "../../services/joinTokenService.mjs";
import { resolveEncodedTripId } from "../../services/idEncoderService.mjs";
import { requireMembership, requireReadAccess } from "../../services/validationService.mjs";
import { auth, optionalAuth } from "./auth.mjs";
import { InvalidError, ForbiddenError } from "../../utils/errors.mjs";

const app = express();

/**
 * Decorate a trip's hydrated users with a `claimed` boolean (seat occupancy).
 * The tokens themselves are never selected — only their presence is queried.
 * @param {object[]} users - hydrated TripUser documents (plain objects)
 * @returns {Promise<object[]>} the users with `claimed` added
 */
const withClaimedSeats = async (users) => {
    const claimedIds = await getClaimedSeatIds(users.map((u) => u._id));
    return users.map((u) => ({ ...u, claimed: claimedIds.has(String(u._id)) }));
};

/**
 * POST /batch — hydrate several trips at once, each entry with its own credential.
 * v3 identity is a per-trip seat token, so membership can only be proven per item:
 * every entry carries the encoded trip id and, for private trips, the seat token
 * associated with that trip. Fail-closed on malformed ids (422). Invisible trips
 * (not found, invalid token, non-member) are silently omitted — distinguishing
 * them would leak the existence of private trips.
 * @body {object[]} trips - [{ id, token? }] (1-30 entries, ids must be unique)
 * @returns {object} - { trips } — only the trips the caller can read,
 *   each with an `encodedId` echoing the `id` the caller sent
 */
app.post("/batch", async (req, res) => {
    const { trips } = req.body ?? {};
    return res.status(200).json({ trips: await batchHydrate(trips) });
});

/**
 * POST / — create a trip (no auth — bootstrap endpoint).
 * Creates seats (TripUsers without tokens), auto-claims the first seat
 * for the creator, and returns the trip + encodedId + creator credentials.
 * @body {object} - trip data with a `users` array (1-20 users)
 * @returns {object} - created trip with encodedId, seats, and creator credentials
 */
app.post("/", async (req, res) => {
    const { users } = req.body ?? {};
    if (!Array.isArray(users) || users.length === 0 || users.length > 20)
        throw new InvalidError("Cannot create trip: a trip must have between 1 and 20 users");

    const tripUsers = await createTripUsers(users);
    const trip = await createTrip({ ...req.body, users: tripUsers });
    await trip.populate("users");

    // Auto-claim the first seat for the creator
    const claimed = await claimSeat(tripUsers[0]._id);

    const seats = tripUsers.map((u) => ({
        _id: u._id,
        name: u.name,
        avatar: u.avatar,
    }));

    return res.status(201).json({
        ...trip.toObject(),
        encodedId: trip.encodedId,
        seats,
        credentials: claimed
            ? { _id: claimed._id, name: claimed.name, token: claimed.token }
            : null,
    });
});

/**
 * GET /:tripId — get a single trip.
 * Public trip: anyone can read. Private trip: authenticated member only.
 * @param {string} tripId - encoded trip id
 * @returns {object} - trip with populated users, each with a `claimed` boolean
 */
app.get("/:tripId", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const includeStops = String(req.query?.includeStops).toLowerCase() === "true";
    const trip = await getTrip(rawId, includeStops);
    requireReadAccess(trip, req.user);
    await trip.populate("users");
    const payload = trip.toObject();
    payload.users = await withClaimedSeats(payload.users);
    return res.status(200).json(payload);
});

/**
 * PUT /:tripId — update a trip (auth + membership required).
 * @param {string} tripId - encoded trip id
 * @body {object} - fields to update
 * @returns {object} - updated trip with populated users, each with a `claimed` boolean
 */
app.put("/:tripId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const savedTrip = await updateTrip(trip, req.body);
    await savedTrip.populate("users");
    const payload = savedTrip.toObject();
    payload.users = await withClaimedSeats(payload.users);
    return res.status(200).json(payload);
});

/**
 * DELETE /:tripId — delete a trip (auth + membership required).
 * @param {string} tripId - encoded trip id
 */
app.delete("/:tripId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    await deleteTrip(rawId);
    return res.status(204).send();
});

/**
 * GET /:tripId/dashboard — aggregated trip stats.
 * Public trip: anyone can read. Private trip: authenticated member only.
 * @param {string} tripId - encoded trip id
 * @returns {object} - dashboard data (stops, goods, events, polls, users, links)
 */
app.get("/:tripId/dashboard", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireReadAccess(trip, req.user);
    const result = await dashboard(trip, req.user?._id);
    return res.status(200).json(result);
});


/**
 * POST /:tripId/share — generate a universal share token (member only).
 * Always returns a join token (JWT) containing the tripId.
 * The /token/:value endpoint resolves it to trip info + available seats.
 */
app.post("/:tripId/share", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);

    const joinToken = await generateJoinToken(rawId);
    return res.status(200).json({ value: joinToken, type: "joinToken" });
});

/**
 * POST /:tripId/join — claim a seat and get a token (soft auth — bootstrap for new users).
 * The x-user-token header is optional: a caller already holding a seat of this trip
 * switches seats in one atomic call instead of leave + join. A token from another
 * trip is ignored (first join as normal).
 * @body {string} [joinToken] - required for private trips, unless the caller is already a member
 * @body {string} [tripUserId] - id of an existing free seat to claim
 * @body {string} [name] - for public trips: create a new seat with this name
 * @body {string} [avatar] - optional avatar for a new seat
 * @returns {object} - { user, token } or { anonymous: true }
 */
app.post("/:tripId/join", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    const { joinToken = "", tripUserId, name, avatar } = req.body ?? {};

    // An authenticated caller already holding a seat of this trip switches seats
    const previousSeatId = req.user && trip.users.some((u) => u.toString() === String(req.user._id))
        ? String(req.user._id)
        : null;

    // Claiming the seat already held: nothing to switch, echo the current identity
    if (previousSeatId && String(tripUserId) === previousSeatId)
        return res.status(200).json({
            user: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar },
            token: req.user.token,
        });

    if (trip.isPrivate) {
        // An authenticated member has already proven access; anyone else needs a join token
        if (!joinToken && !previousSeatId)
            throw new ForbiddenError("Join token required for private trips");
        if (joinToken)
            await verifyJoinToken(joinToken, rawId);

        // Private: must pick an existing free seat
        if (!tripUserId)
            throw new InvalidError("Must select a seat to join a private trip");

        if (!trip.users.some((u) => u.toString() === String(tripUserId)))
            throw new ForbiddenError("This seat is not part of this trip");

        const claimed = previousSeatId
            ? await switchSeat(previousSeatId, tripUserId)
            : await claimSeat(tripUserId);
        if (!claimed)
            throw new ForbiddenError("This seat is already taken");

        return res.status(200).json({
            user: { _id: claimed._id, name: claimed.name, avatar: claimed.avatar },
            token: claimed.token,
        });
    }

    // Public trip
    if (tripUserId) {
        // Claim an existing free seat
        if (!trip.users.some((u) => u.toString() === String(tripUserId)))
            throw new ForbiddenError("This seat is not part of this trip");

        const claimed = previousSeatId
            ? await switchSeat(previousSeatId, tripUserId)
            : await claimSeat(tripUserId);
        if (!claimed)
            throw new ForbiddenError("This seat is already taken");

        return res.status(200).json({
            user: { _id: claimed._id, name: claimed.name, avatar: claimed.avatar },
            token: claimed.token,
        });
    }

    if (name) {
        // Create a new seat (transactional: the 20-seat limit is enforced atomically)
        if (trip.users.length >= 20)
            throw new InvalidError("Cannot join: trip already has the maximum number of users");

        const [newUser] = await addSeatsToTrip(rawId, [{ name, avatar }]);

        // Mint token on the new seat (releasing the previous one if this is a switch)
        const claimed = previousSeatId
            ? await switchSeat(previousSeatId, newUser._id)
            : await claimSeat(newUser._id);

        return res.status(200).json({
            user: { _id: claimed._id, name: claimed.name, avatar: claimed.avatar },
            token: claimed.token,
        });
    }

    // Pass — browse anonymously. A member with no target seat gets their
    // current identity echoed back instead of an anonymous response.
    if (previousSeatId)
        return res.status(200).json({
            user: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar },
            token: req.user.token,
        });

    return res.status(200).json({ anonymous: true });
});

/**
 * POST /:tripId/leave — release the caller's seat (auth required).
 * Clears the token on the TripUser. The seat becomes free for someone else.
 * Content stays linked to the TripUser ObjectId.
 */
app.post("/:tripId/leave", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);

    await releaseSeat(req.user._id);
    return res.status(204).send();
});

export default app;
