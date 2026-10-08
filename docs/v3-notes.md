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

## Contexte trip dans les routes v3 (`loadTripContext`)

- Pattern standard pour toute route v3 scopée sur un trip : `const { rawId, trip } = await loadTripContext(req, requireReadAccess)` en première ligne du handler (`services/tripContextService.mjs`). Résout l'id chiffré, charge le trip, applique le garde (`requireReadAccess` ou `requireMembership` de `validationService`), retourne `{ rawId, trip }`. Erreurs : `InvalidError` (id altéré, 422), trip introuvable (404), `ForbiddenError` (403).
- Garde passé explicitement en paramètre (choix délibéré vs middleware `req.tripContext`) : une route de lecture sans garde saute aux yeux au review au lieu d'être silencieusement publique.
- Migrations opportunistes restantes (prélude manuel `resolveEncodedTripId` + `getTrip` + garde, à remplacer au passage quand on touche le fichier) : `routes/v3/events.mjs`, `goods.mjs`, `links.mjs`, `polls.mjs`, `trips.mjs`, `tripStops.mjs`, `tripUsers.mjs`. Référence : `routes/v3/messages.mjs` (10 routes migrées).
- Même idée pour la pagination des listes : `buildNextCursor(items, limit, fields)` (`utils/pagination.mjs`) remplace le bloc `items.length === limit ? buildCursor({...}) : null` — candidats : `events.mjs` (`['_id', 'startDate']`), `polls.mjs` (`['_id']`), `goods.mjs` (attention : `._id.toString()` appliqué avant sérialisation).

## encodedId persiste sur Trip (fix duplications)

- **Probleme** : `encodeId` (AES-256-GCM, IV aleatoire) n'etait pas idempotent — deux mints du meme trip donnaient deux strings valides mais distinctes. Le front memorisant des couples (encodedId, token), un meme trip partage/joint plusieurs fois creeait des entrees dupliquees.
- **Decision (option A, persiste)** : champ `Trip.encodedId` (String, unique, **sparse** — obligatoire pour que les trips legacy sans le champ ne violent pas l'index unique). Minte une seule fois par hook `pre("save")` dans tripModel, jamais regenere.
- Contrat : **tous les points qui servent un encodedId lisent le champ persiste** — POST /trips (creation), GET /trips/:tripId (inclus via toObject), resolution des join tokens (`tokens.mjs`), `migrate.mjs`. `batchHydrate` continue d'echoyer l'id envoye par le client. **Jamais de `encodeId(trip._id)` en route** : c'est le bug.
- Trips legacy sans champ : `tripService.getOrCreateEncodedId(trip)` mint + persiste paresseusement a la volee (update atomique `$exists`-garde, first-write-wins, les perdants relisent le gagnant). `migrate.mjs` est donc le vecteur de migration naturel : chaque appel cutover persiste l'id du trip migre.
- Backfill one-shot : `node scripts/backfillEncodedIds.mjs` (meme garde `$exists`, sur a lancer pendant que l'API tourne ; exit 1 s'il reste des trips sans champ).
- Les ancres : le resolve reste `decodeId` (chiffrement aleatoire conserve — la stabilite vient de la persistance, pas du determinisme). Une rotation de `OBFUSCATION_KEY` casserait toujours les ids stockes cote front, mais le champ en base permettrait un jour de resoudre par lookup DB.
## Reactions sur les messages (v3)

- Modele : sous-docs `reactions: [{ emoji, users: [TripUserId] }]` dans `Message` — le count se deduit de `users.length`, pas de champ denormalise.
- Whitelist stricte cote service (`ALLOWED_REACTIONS`, messageService) : thumbs up `\u{1F44D}`, thumbs down `\u{1F44E}`, red heart `\u{2764}\u{FE0F}` (**avec le variation selector FE0F — le front doit envoyer exactement cette string**), tears of joy `\u{1F602}`, crying `\u{1F622}`. Hors whitelist → 422.
- Routes membre uniquement : `POST`/`DELETE /trips/:tripId/messages/:messageId/reactions`, body `{ emoji }` (DELETE accepte aussi `?emoji=` pour les clients qui droppent le body). Idempotents (`$addToSet`/`$pull`), reponse `{ reactions }` a jour. Message inconnu → 404.
- Race premier react : deux updates (attach du sous-doc, puis `$addToSet`) avec repli si une requete concurrente a pose l'emoji entre les deux ; d'eventuels doublons d'entree `emoji` ne cassent rien mais ne sont pas dedoublonnes a la lecture.
- La projection de `search` inclut `reactions` (piege des projections : pensez a l'ajouter aux futures projections).
## Link preview v3 (POST /v3/link-preview)

- Remplace le endpoint v1 (`routes/link-preview.mjs`, conserve en legacy). Logique dans `services/linkPreviewService.mjs`, route = delegation. Pas de trip scope : ouvert derriere la cle API + rate limit dedie **20 req/min/IP** (le global 1000/15min est trop leger pour un scraper).
- **SSRF** : `resolvePublicAddress` (dns.lookup + `isPrivateAddress`) rejette loopback, privees 10/172.16/192.168, CGNAT 100.64/10, link-local 169.254/16 (metadata cloud), multicast, et leurs equivalents IPv6. Passe aussi a la lib via `resolveDNSHost` → chaque redirect revalide. 403 `ForbiddenError` si vise ; 422 si URL mal formee ou host non resolvable (v1 renvoyait 500, corrige).
- **Anti-bot (booking.com & co)** : 2 profils navigateur reels (Chrome complet avec sec-fetch headers, puis Safari) — essai 1, si le titre matche les `DENIED_KEYWORDS` (murs Cloudflare, "Just a moment", captcha...) on retente avec le profil 2. Si tout est rebute : **carte fallback** `{ title: domaine, fallback: true }` — le front rend toujours quelque chose. Timeout 10s par essai (v1 : 30s).
- Redirections : `manual` + `isSameSiteRedirect` — meme hote, variantes www, et sous-domaines de l'hote d'origine (booking bascule fr.booking.com / secure.booking.com), cible revalidee par le garde DNS a chaque hop.
- Tests : `services/linkPreviewService.test.mjs` (17 cas `isPrivateAddress` dont IPv6 mapped, retry profil 2 simule booking, fallback, 422/403) + `routes/v3/linkPreview.test.mjs` (200/422/403). Le comportement REEL contre booking.com est hors portee des unites (lib mockee) — a verifier en integration manuelle.
- Si le taux de fallback reste eleve : prochaines etapes possibles = fetch maison + `getPreviewFromContent` (la lib v4 permet de parser du HTML pre-fetche, ex. via un proxy residentiel) ou un renderer headless type puppeteer — plus lourd.
## Suivis ouverts

- Migrer les routes v3 restantes vers `loadTripContext` + `buildNextCursor` (voir sections dédiées) — opportuniste, au fil des PR.
- Lancer 
ode scripts/backfillEncodedIds.mjs en prod apres le deploy (les appels migrate/tokens auto-guerissent le reste opportunistement).
- Vérification manuelle en conditions réelles : transactions tripStops (créations concurrentes à 49 stops), batch hydrate.
- Pas de test couvrant le curseur des messages contre une vraie query (service mocké).
- UserAccount (comptes) : non prévu court terme ; si introduit, revoir `GET /`-like et `requireSeatOwnership`.
