# AGENTS.md — vakeo-api

API Express (ESM, "type": "module") pour l'app de planification de voyages Vakeo. MongoDB via mongoose. Deux versions de routes cohabitent : v1 (`routes/*.mjs`, legacy, non migrée) et v3 (`routes/v3/*.mjs`, active).

## Lire en premier

`docs/v3-notes.md` — carnet de conventions, décisions et pièges v3 (modèle d'identité par sièges, ids chiffrés, pagination curseurs, transactions, projections). Le mettre à jour quand une décision évolue ou qu'un piège nouveau est trouvé.

## Commandes

- Tests : `node --experimental-vm-modules node_modules/jest/bin/jest.js` (depuis la racine). Tout est mocké — aucune vraie base en test. Les tests chargent `.env` (dotenv) ; `TOKEN_SECRET` y est requis.
- Syntaxe seule : `node --check <fichier>` (utile avant de lancer Jest).
- Démarrage : `node index.mjs`. Pas de lint configuré.

## Conventions de code

- Couches : `routes/v3/*` = délégation + statuts HTTP uniquement ; `services/*` = logique métier ; `models/*` = schémas mongoose ; `utils/*` = helpers purs.
- Erreurs : classes de `utils/errors.mjs` avec `statusCode` (NotFoundError 404, InvalidError 422, ForbiddenError 403) — remontées telles quelles par `middlewares/errorMiddleware.mjs`. Ne jamais renvoyer manuellement un statut d'erreur métier.
- Route v3 scopée sur un trip : première ligne du handler = `await loadTripContext(req, requireReadAccess | requireMembership)` (`services/tripContextService.mjs`). Liste des fichiers à migrer opportunistement : voir v3-notes.
- Listes paginées : curseur opaque base64 via `buildCursor`/`readCursor` + `buildNextCursor(items, limit, fields)` (`utils/pagination.mjs`).
- Accès : v3 n'a pas de comptes — identité = siège `TripUser`, auth par header `x-user-token` (passport, `routes/v3/auth.mjs` : `auth` / `optionalAuth`).
- Ids de trip chiffrés dans les URLs v3 (AES-256-GCM, `idEncoderService`) — jamais d'ObjectId brut côté client.

## Pièges connus (lire avant d'éditer)

- **Tous les fichiers du repo sont en CRLF.** Les éditions multi-lignes par remplacement de texte doivent ancrer les fins de ligne explicitement. Toujours re-vérifier (`node --check`) après édition.
- **Projections mongoose** : quand un champ est ajouté à un schéma (ex. `reactions` sur Message), vérifier toutes les projections existantes qui le traversent (`search` de messageService). Les mocks de tests ne détectent pas les champs manquants.
- **Tests mockés via `jest.unstable_mockModule`** : un mock de service doit fournir TOUTES les exports que les routes importent (ESM valide les imports nommés).
- Les fonctions DB (mongoose) ne sont pas testées unitairement — le tester via tests de routes (mock du service) + intégration manuelle. Convention documentée dans les fichiers de test existants.
- v1 et v3 partagent les services : un changement de service impacte les deux versions ; vérifier les usages v1 avant de changer une signature.

## Git

- Jamais de push sans demande explicite. Scripts `release:*` font `npm version` + push — ne pas lancer sans accord.