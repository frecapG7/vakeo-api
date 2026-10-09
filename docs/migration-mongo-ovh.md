# Notes infra : migration MongoDB OVH (octobre 2026)

> Tarifs relevés le 9 octobre 2026, hors taxes, à revérifier dans le configurateur
> de l'espace client avant toute souscription.

## Contexte

`vakeo-prod` (instance `4321955b-d0df-47f1-8746-ed5ed97baf0b`) tourne sur l'offre
**gratuite Discovery MongoDB DB2-FREE** (mono-noeud). OVH arrête cette offre :

| Date | Échéance |
|---|---|
| 31 août 2026 | Fin de vente (passée) |
| **31 octobre 2026** | Suspension des instances — réactivation possible uniquement pour migrer / récupérer les données |
| **30 novembre 2026** | Résiliation, suppression définitive des instances et des données |

## Décision

Migration vers l'offre **OVH Production DB2-2** (~54 $/mois HT, ~50 €) :

- replica set 3 noeuds, multi-AZ, SLA 99,95 %
- snapshots avec rétention 14 jours
- 1 vCPU / 2 GB RAM par noeud, stockage de 10 à 100 GiB, 100 Mbit/s

### Pourquoi pas ailleurs (comparatif du 9/10/2026)

| Fournisseur | Offre | Topologie | Prix/mois HT env. |
|---|---|---|---|
| **OVH** | Production DB2-2 | 3 noeuds + backups 14 j + SLA | **~50 €** |
| Scaleway | MGDB-PLAY2-NANO (2 vCPU, 4 GB) | 1 noeud, sans SLA (gamme dev) | ~79 € |
| Scaleway | MGDB-PLAY2-NANO | 3 noeuds | ~240 € |
| MongoDB Atlas | M10 | 1 noeud dédié | ~53 € |

Le managé MongoDB démarre autour de 50 €/mois partout : un replica set compte
minimum 3 noeuds. Le DB2-2 est le meilleur rapport qualité/prix du lot.

### Pourquoi pas du self-hosting

Écarté : sauvegardes (`mongodump` nocturne vers Object Storage), MAJ de sécurité,
`rs.initiate()` obligatoire en mono-noeud pour les transactions, restaurations à
tester — tout ça pour économiser ~50 €/mois sur la donnée de prod.

## Checklist migration (avant le 31 octobre)

1. `mongodump` de `vakeo-prod` **dès maintenant** (garder l'archive en lieu sûr).
2. Migration via l'espace client : onglet « Configuration » → ligne « Plan » →
   « Modifier » → plan « Production ». Facturation dès la mise en service.
3. Vérifier la nouvelle `MONGO_URI` (credentials, port, options replica set).
4. Basculer `MONGO_URI` dans le `.env` de vakeo-api.
5. Tester les routes transactionnelles (v3 : charges de trip, etc.) sur le
   nouveau cluster.
6. Après bascule : supprimer l'instance Discovery suspendue du projet Public Cloud.

### Impact code

- Aucun changement de code attendu : les transactions mongoose passent d'autant
  mieux sur un replica set 3 noeuds.
- Seul le `.env` change (`MONGO_URI`).

## Pour les projets futurs

- **Postgres managé par défaut** (~11 €/mois en entrée chez OVH) pour les CRUD
  relationnels ; MongoDB quand les données sont naturellement imbriquées
  (modèle documents). Le managé relationnel est nettement moins cher que le
  managé MongoDB.
- Règle de poche : entités reliées entre elles → Postgres ; documents imbriqués
  qui vivent ensemble → Mongo (JSONB de Postgres couvre les cas intermédiaires).
- Mutualisation possible : plusieurs bases logiques sur une seule instance
  managée pour les petits projets.
- Offre Discovery gratuite existante côté bases relationnelles pour valider un
  schéma en dev avant de passer en Production.
