# MESSAF-BF — Portail d'administration, espace RH

Front-End du module d'**enrôlement des agents** du portail MESSAF-BF (Messagerie Sécurisée de l'Administration du Faso).
Il permet à un responsable RH (`gestionnaire_rh`) de créer le compte d'un agent de son ministère et de lui remettre sa fiche d'enrôlement.

> **État actuel : prototype en mode démonstration.** La connexion est fictive, les données sont fictives et les créations sont simulées dans le navigateur. **Aucun compte Keycloak ni Matrix n'est créé.** Le raccordement à Keycloak et à l'API d'administration (Axel) est préparé, pas encore effectué.

Ce dossier correspond à `messaf/portail/` dans le dépôt commun.

## Lancer le prototype

Prérequis : Node.js 20 ou plus récent.

```bash
cd portail
npm install
npm run dev
```

Ouvrir http://localhost:5173, puis se connecter avec un compte de démonstration (mot de passe commun : `demo`) :

| Identifiant | Compte fictif | Résultat attendu |
|---|---|---|
| `100003` | Mariam Traoré, `gestionnaire_rh`, Santé | Accès à l'espace RH du ministère de la Santé |
| `100011` | Boukary Nikéma, `admin_ministere`, Finances | Accès refusé (pas de rôle `gestionnaire_rh`) |
| `100008` | Fatimata Diallo, sans rôle | Accès refusé (messagerie uniquement) |

Autres commandes :

```bash
npm run typecheck   # vérification TypeScript
npm run build       # build de production dans dist/
npm run preview     # sert le build
```

### Scénario de démonstration (moins d'une minute)

1. Se connecter avec `100003` / `demo`.
2. Cliquer sur **Enregistrer un nouvel agent**.
3. Saisir le matricule `100012` : l'identifiant `@m100012:gov.bf` s'affiche aussitôt. Le matricule `100005` est refusé (déjà utilisé).
4. Choisir Santé, puis Direction des hôpitaux, puis Service de la qualité des soins, et le poste `CS-SQS-SANTE`.
5. Garder l'habilitation proposée par le poste, vérifier le récapitulatif, puis confirmer.
6. Sur l'écran de confirmation, télécharger la fiche d'enrôlement de démonstration.

Astuce de test : un matricule commençant par `999` simule une erreur du serveur.

## Technologies

| Dépendance | Version | Licence | Rôle |
|---|---|---|---|
| [React](https://react.dev) | 19 | MIT | Interface |
| [React Router](https://reactrouter.com) | 7 | MIT | Navigation et routes protégées |
| [React Hook Form](https://react-hook-form.com) | 7 | MIT | Formulaires |
| [Zod](https://zod.dev) | 4 | MIT | Validation des saisies |
| [@hookform/resolvers](https://github.com/react-hook-form/resolvers) | 5 | MIT | Lien Zod ↔ React Hook Form |
| [jsPDF](https://github.com/parallax/jsPDF) | 4 | MIT | Fiche PDF de démonstration uniquement, chargée à la demande |
| [Lucide](https://lucide.dev) | 1 | ISC | Icônes |
| [Vite](https://vite.dev) | 7 | MIT | Outil de développement et de build |
| [TypeScript](https://www.typescriptlang.org) | 5.9 | Apache-2.0 | Typage |

CSS : une seule feuille (`src/styles/global.css`) avec des variables, sans framework. La palette s'inspire du drapeau : vert dominant, rouge réservé aux alertes, or pour les repères.

## Structure

```text
src/
├── config/        env.ts (variables), api.ts (routes), messaf.ts (conventions : domaine, matricule, rôles)
├── types/         messaf.ts (rôles, habilitations, états), identity.ts, profile.ts, position.ts,
│                  assignment.ts, structure.ts, agent.ts, auth.ts
├── services/      api.ts (client HTTP + jeton), errors.ts
│   ├── agents.service.ts      interface + choix démo/API
│   ├── agents.api.ts          implémentation réelle (POST /agents, GET …/fiche-enrolement)
│   ├── referentiel.*.ts       organigramme et postes (lecture seule)
│   ├── auth.service.ts        interface + choix démo/Keycloak
│   ├── auth.keycloak.ts       raccordement Keycloak préparé, non connecté
│   └── demo/                  SIMULATIONS : auth, agents, référentiel, fiche PDF
├── mocks/         données fictives (jeu commun de la section 10, organigramme, comptes)
├── validation/    schémas Zod des quatre étapes
├── contexts/      AuthContext (session), ReferentielContext (organigramme du ministère)
├── hooks/         useAsync, useAgents, useReferentiel, useFicheEnrolement
├── components/    layout/, navigation/ (route protégée, menu), forms/, tables/, ui/, agents/ (parcours, résumé, fiche)
└── pages/         auth/ConnexionPage, dashboard/TableauDeBordPage, agents/ (liste, détail, création, confirmation)
```

Règles suivies :

- **Aucun appel HTTP dans les composants.** Les pages passent par `agentsService`, `referentielService` et `authService`. Ces services choisissent eux-mêmes l'implémentation démo ou réelle.
- **Les quatre objets du modèle restent séparés** : identité, profil, poste et affectation, avec un type par objet, un bloc par objet à l'écran et une section par objet dans le corps envoyé à l'API. L'habilitation et l'état sont des attributs du compte.
- Les valeurs techniques exactes sont transmises (`normal`, `diffusion_restreinte`, `confidentiel`). Seuls les libellés sont en français.

## Écrans

| Route | Écran |
|---|---|
| `/connexion` | Connexion RH (démo : identifiant et mot de passe fictifs ; Keycloak : redirection) |
| `/` | Tableau de bord : agents du périmètre, comptes actifs, créations de la session, derniers ajouts |
| `/agents` | Liste : recherche par matricule ou nom (sans tenir compte des accents), filtres direction et état ; tableau sur grand écran, cartes sur petit écran |
| `/agents/:matricule` | Fiche détaillée : les 4 objets et la fiche d'enrôlement |
| `/agents/nouveau` | Parcours en 5 étapes : identité, profil, poste et affectation, habilitation, récapitulatif |
| `/agents/:matricule/creation-confirmee` | Confirmation : identifiant Matrix, informations clés, fiche PDF |

Toutes les routes, sauf `/connexion`, exigent une session et le rôle `gestionnaire_rh`. Ce contrôle n'est qu'un confort d'affichage : **seule l'API protège réellement les données**, en vérifiant le rôle et le ministère.

## Variables d'environnement

Copier `.env.example` en `.env.local`. Aucun secret n'y figure : le portail est un client public.

| Variable | Valeurs | Défaut | Effet |
|---|---|---|---|
| `VITE_DATA_SOURCE` | `demo` \| `api` | `demo` | Données simulées ou API d'administration |
| `VITE_AUTH_MODE` | `demo` \| `keycloak` | `demo` | Connexion fictive ou Keycloak |
| `VITE_API_BASE_URL` | URL | `http://localhost:8000` | Base de l'API d'administration |
| `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` | — | vides | Paramètres du client Keycloak |

Le bandeau jaune « MODE DÉMONSTRATION » s'affiche dès que l'une des deux premières variables vaut `demo`.

## Mode démonstration

- **Connexion** (`services/demo/auth.demo.ts`) : comptes fictifs de `mocks/comptes-demo.mock.ts`. Le mot de passe est comparé puis oublié. Seuls le nom, les rôles et le ministère sont gardés dans le `sessionStorage`, effacé à la fermeture de l'onglet.
- **Agents** (`services/demo/agents.demo.ts`) : le jeu commun 100001 à 100011 est toujours présent. Les agents créés pendant les essais sont gardés dans le `localStorage` : données fictives uniquement, sans mot de passe ni code. Le tableau de bord permet de les effacer. La simulation imite le serveur : cloisonnement par ministère, refus des doublons (409), contrôle de cohérence avec l'organigramme (422) et délais de réponse.
- **Fiche d'enrôlement** (`services/demo/fiche.demo.ts`) : PDF généré dans le navigateur. Il porte la mention « DOCUMENT DE DÉMONSTRATION — NON VALABLE POUR UN ENRÔLEMENT RÉEL » et **ne contient aucun code d'activation**.
- Adresses fictives en `.messaf.example`, un domaine réservé qui n'est jamais attribué.

## Raccordement futur

### API d'administration

1. Mettre `VITE_DATA_SOURCE=api` et `VITE_API_BASE_URL`.
2. Une fois `api/openapi.yaml` validé, aligner les types `CreerAgentRequete` et `CreerAgentReponse` de `services/agents.api.ts`, ainsi que la lecture des erreurs dans `services/api.ts`.
3. Brancher les routes de lecture manquantes (voir plus bas) dans `agents.api.ts` et `referentiel.api.ts`.

Aucun composant n'est à modifier. En attendant ces routes, le mode API affiche « Fonction pas encore raccordée » au lieu d'inventer des données.

### Keycloak

1. `npm install keycloak-js`.
2. Implémenter les quatre méthodes de `services/auth.keycloak.ts` (flux Authorization Code avec PKCE, `check-sso`, `updateToken`). La marche à suivre est indiquée en commentaire dans le fichier.
3. Construire la session avec `sessionDepuisJeton(keycloak.tokenParsed)`, déjà écrit.
4. Mettre `VITE_AUTH_MODE=keycloak`. Le jeton est joint automatiquement à chaque appel API (`Authorization: Bearer`).

## Points à valider avec Axel

| Sujet | Hypothèse provisoire dans le code | Où |
|---|---|---|
| Schéma JSON de `POST /agents` (requête, réponse, erreurs) | Sections `identite` / `profil` / `habilitation` / `affectation`, champs en snake_case ; erreurs `{message, code, champs}` ; 409 = matricule existant | `services/agents.api.ts`, `services/api.ts` |
| Liste et consultation des agents | Aucune route dans le document : à ajouter (par exemple `GET /agents`, `GET /agents/{matricule}`) | `agents.api.ts` |
| Organigramme et postes | Aucune route : à ajouter (lecture des structures et des postes d'un ministère) | `referentiel.api.ts` |
| Vérification anticipée d'un matricule | Pas de route : l'unicité est vérifiée au `POST` | `agents.api.ts` |
| Format du matricule | 6 chiffres, comme dans le jeu de données | `config/messaf.ts` |
| Valeur des attributs `ministere`, `direction`, `service` | Codes de structure (`sante`, `sante-dh`…), pas des libellés | `types/profile.ts` |
| Accès de `admin_ministere` à l'enrôlement | Non : seul `gestionnaire_rh` y accède | `config/messaf.ts` |
| Contenu du jeton | Rôles dans `realm_access.roles` ; `matricule` et `ministere` exposés dans le jeton | `auth.keycloak.ts` |
| Client Keycloak du portail | Realm `messaf`, client public `portail` | `.env.example` |
| État initial d'un compte créé | Renvoyé par le serveur (la démo affiche `actif`) | `agents.api.ts` |

## Hors périmètre de cette version

Messagerie, rôles, espace super-administrateur, gestion des structures et des postes, passation et intérim, suspension, réactivation et révocation, journal d'audit, convocations, suivi des actions, application Android, chiffrement, configuration de Keycloak, Synapse et PostgreSQL.
