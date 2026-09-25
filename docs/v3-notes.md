# v3 — Conventions, décisions et pièges

Notes de contexte pour travailler sur l'API v3. Fichier maintenu à la main — le mettre à jour quand une décision évolue.

## Modèle d'identité v3

- **Pas de compte utilisateur.** L'identité est un siège (`TripUser`), propriété d'un seul trip.
- Le client s'authentifie avec le token du siège (header `x-user-token`, stratégie passport `user-token`).
- Un siège ne référence pas son trip (`Trip.users` porte les refs) — impossible de faire "mes trips" côté serveur. Conséquence : le front mémorise les couples (encodedId, token), d'où `POST /trips/batch`.
- Les ids de trip dans les URLs v3 sont chiffrés (AES-256-GCM, `idEncoderService`) — jamais d'ObjectId brut. `resolveEncodedTripId` jette `InvalidError` (422) sur id altéré.

## Pagination (curseurs)

- Contrat commun aux listes v3 (events, polls, messages) : curseur opaque base64 via `buildCursor`/`readCursor` (`utils/pagination.mjs`), envoyé tel quel en query `cursor`, arrêt quand `nextCursor` vaut `null`. Plus de `prevCursor`.
- Le curseur embarque le champ de tri + `_id` en tie-breaker : events `{ _id, startDate }` (tri asc), messages `{ _id, createdAt }` (tri desc, `createdAt`/`_id` en `-1`), polls `{ _id }`.
- Un curseur malformé → `InvalidError` (fail-closed).
- **Breaking pour le front** : ancien format `_id` brut refusé depuis la migration.

## POST /trips/batch (hydratation multi-identités)

- Body : `{ trips: [{ id, token? }] }`, 1 à 30 entrées, ids uniques (doublon → 422 global).
- Réponse : `{ trips: [...] }` — uniquement les trips lisibles, **dans l'ordre du batch**.
- Toute la logique est dans `tripService.batchHydrate` ; la route (`routes/v3/trips.mjs`) est un délégué de 3 lignes.
- Deux requêtes DB : `getTripUsersByTokens` (tokens → sièges), puis un `Trip.find` avec la visibilité **dans la query** :
  `$or: [{ isPrivate: { $ne: true } }, { users: { $in: seatIds } }]`.
  Un seul `$lookup`-free one-shot est impossible tant que `TripUser` n'a pas de champ `trip`.
- Le critère est "n'importe lequel de mes sièges débloque un trip privé du batch" (détention du token = preuve), pas le couple (id, token) exact.
- Omission silencisée des trips invisibles — distinguer "introuvable" d'interdit fuiterait l'existence des privés.
- **Règle de visibilité dupliquée** : elle vit dans la query ET dans `canReadTrip` (`validationService`). Garder synchrones (`requireReadAccess` utilise `canReadTrip`).

## Transactions MongoDB

- **Toujours `session.withTransaction`** (jamais le manuel `startTransaction/commitTransaction`) : retry auto des erreurs transitoires.
- Prérequis : replica set / sharded / managé. Prod et local = cluster OVH Public Cloud (replica set 3+ nœuds, `mongodb+srv`). Pas de standalone nulle part, pas de CI.
- Pattern `addSeatsToTrip` (enfants embarqués dans Trip) : update conditionnel `$expr` pour la limite, dans la transaction.
- Pattern `createTripStop` (enfants hors Trip) : write de synchronisation sur le doc trip au début de la transaction (`$set updatedAt`) → write conflict entre créations concurrentes → retry `withTransaction` avec snapshot frais → recomptage de la limite. TOCTOU sinon.

## Config / démarrage

- `TOKEN_SECRET` : requis, ≥ 32 caractères, validé au chargement de `config.mjs` (fail-fast). Utilisé aussi comme fallback d'`obfuscation_key` (idEncoderService).
- Les tests Jest chargent `.env` (dotenv) — `TOKEN_SECRET` y est défini (44 chars).

## Tests

- `node --experimental-vm-modules node_modules/jest/bin/jest.js`. Tout mocké via `jest.unstable_mockModule` — aucune vraie base en test.
- Répartition : routes = délégation + statuts HTTP ; services (`*.test.mjs`) = logique, avec mocks de modèles.
- Attention au piège des mocks : retourner des documents "complets" masque les bugs de projection (la fuite `isPrivate` est passée à travers parce que les mocks contenaient le champ).

## Pièges repo

- **Fichiers en CRLF** (`services/*`, `config/*`) vs LF (`routes/v3/*`, `tripUserService`) : les éditions multi-lignes échouent sur les CRLF — ancrer sur des lignes uniques.
- v1 (`routes/*.mjs`) partage les services. `tripService.search` (utilisé par v1) a reçu `isPrivate` en projection — même fuite corrigée des deux côtés, mais v1 n'est pas "migrée".
- `Trip.find` avec projection explicite : toujours vérifier que les champs testés en aval (`isPrivate` !) y figurent.

## Suivis ouverts

- Vérification manuelle en conditions réelles : transactions tripStops (créations concurrentes à 49 stops), batch hydrate.
- Pas de test couvrant le curseur des messages contre une vraie query (service mocké).
- UserAccount (comptes) : non prévu court terme ; si introduit, revoir `GET /`-like et `requireSeatOwnership`.
