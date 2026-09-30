# Tournoi de belote

Application de gestion de tournoi de **belote contrée** en **rondes suisses**,
conforme au règlement de la Belote Contrée Parisienne (2019) : un nombre
paramétrable de rondes suisses de qualification (4 par défaut), puis une
finale entre les deux premières équipes du classement.

Tout tourne dans le navigateur. Aucun serveur, aucun compte, hébergement gratuit.

## Ce que fait l'application

- **Inscription** des équipes de 2 joueurs, avec reconnaissance des joueurs
  déjà venus lors d'un tournoi précédent.
- **Appariement en rondes suisses** : tirage au sort intégral à la 1re ronde,
  puis appariement par victoires et goal average, sans jamais rejouer un
  adversaire déjà rencontré tant qu'un autre appariement existe.
- **Effectif impair** : une équipe est exempte à chaque manche et marque une
  victoire ; l'exemption ne revient pas deux fois à la même équipe tant que
  d'autres n'en ont pas eu.
- **Saisie du score** au choix :
  - le total final de la manche, rapide ;
  - ou **donne par donne**, avec un calculateur qui applique le barème
    (contrat, contre, surcontre, belote, capot, arrondi à la dizaine).
- **Pénalités de retard** (200 points par tranche de 5 minutes) et **forfait**
  au bout de 30 minutes (partie perdue, goal average de −1001).
- **Classement** en direct, victoires puis goal average.
- **Finale** entre les deux premières équipes du classement des rondes suisses.
- **Statistiques joueurs** cumulées sur tous les tournois enregistrés.
- **Export / import JSON** pour sauvegarder ou transférer les données.

## Démarrer

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # 74 tests
npm run build    # génère dist/
```

## Héberger gratuitement

### GitHub Pages (configuré)

1. Créer un dépôt **nommé `belote-tournoi`** et y pousser ce code.
2. Dans *Settings → Pages*, choisir **Source : GitHub Actions**.
3. Pousser sur `main` : le workflow `.github/workflows/deploy.yml` lance les
   tests puis publie sur `https://<utilisateur>.github.io/belote-tournoi/`.

Si le dépôt porte un autre nom, ajuster `base` dans `vite.config.ts`.

### Cloudflare Pages / Netlify (alternative)

Build : `npm run build`, dossier de sortie : `dist`, variable d'environnement
`BASE_PATH=/`. Les deux offres gratuites conviennent et permettent un domaine
personnalisé sans frais.

## Utilisation le soir du tournoi

1. **Créer le tournoi** (nom, date, nombre de rondes suisses, phase finale).
2. Onglet **Équipes** : inscrire les équipes. La composition se fige dès le
   premier tirage.
3. Onglet **Manches** : *Tirer la manche 1*, annoncer les tables.
4. Saisir le score de chaque partie au fil de l'eau. Le classement se met à
   jour automatiquement.
5. Une fois tous les scores saisis, *Tirer la manche 2*, et ainsi de suite.
6. Après la dernière ronde : *Lancer la finale*, qui oppose les deux premières
   équipes du classement.

Une erreur de saisie se corrige avec **Rouvrir** sur la partie concernée. Un
tirage malheureux s'annule avec **Annuler la manche**.

> **Sauvegarde** : les données vivent dans le navigateur de la machine qui
> saisit. Exportez le JSON en fin de soirée depuis l'écran d'accueil.

## Organisation du code

```
src/
  domain/          logique métier, pure et testée, sans dépendance à React
    types.ts       modèle de données
    scoring.ts     barème de la belote contrée (§4 du règlement)
    swiss.ts       appariement en rondes suisses, finale
    standings.ts   classement
    tournament.ts  opérations sur un tournoi (tirage, saisie, annulation)
    stats.ts       statistiques joueurs multi-tournois
  storage/
    types.ts       contrat `TournamentStore`, asynchrone
    localStore.ts  implémentation localStorage + export/import JSON
  ui/              composants React
```

Le domaine ne connaît ni React ni le stockage : toutes ses fonctions sont
pures et renvoient un nouveau tournoi. C'est ce qui rend le barème et
l'appariement vérifiables par les tests, indépendamment de l'interface.

## Faire évoluer vers une base de données

L'interface `TournamentStore` (`src/storage/types.ts`) est **déjà
asynchrone** : brancher un backend ne demande ni de la modifier, ni de
toucher au domaine ou aux composants.

Pour synchroniser plusieurs appareils ou consolider les statistiques :

1. Écrire un `RemoteTournamentStore implements TournamentStore` qui appelle
   une API HTTP.
2. Remplacer l'export `store` dans `src/storage/localStore.ts` par une
   sélection selon la configuration.
3. Conserver le stockage local en cache hors-ligne si besoin.

**Option recommandée : Cloudflare Pages + D1.** L'hébergement statique, les
Workers et la base D1 (SQLite) sont gratuits dans des limites très au-dessus
des besoins d'un tournoi mensuel, et la base ne se met pas en veille. Schéma
de départ : une table par entité du modèle (`players`, `tournaments`, `teams`,
`matches`, `donnes`), les `id` étant déjà des UUID générés côté client — la
synchronisation ne pose donc pas de conflit de clés.

Supabase (Postgres + authentification) convient aussi, avec une réserve : le
tier gratuit met le projet en pause après 7 jours d'inactivité, ce qui gêne
pour un usage mensuel.

## Règles implémentées

Le barème suit la section 4 du règlement de la Belote Contrée Parisienne.
Chaque exemple chiffré du document est couvert par un test dans
`src/domain/scoring.test.ts` :

| Situation | Marque |
| --- | --- |
| Contrat réussi | points réalisés (arrondis) + contrat |
| Chute | 0 pour le preneur, 160 + contrat pour la défense |
| Contré réussi | contrat × 2 + 160 |
| Surcontré réussi | contrat × 3 + 160 |
| Contré/surcontré avec capot | contrat × 2 ou × 3, + 250 |
| Capot non demandé | 250 + contrat |
| Capot demandé réussi | 500 |
| Capot demandé chuté | 410 pour la défense |
| Belote | 20 à son détenteur, en toutes circonstances |

L'arrondi se fait à la dizaine inférieure de 1 à 5, supérieure de 6 à 9, et
ne permet jamais de réaliser le contrat : 89 points demandés à 90 chutent.
