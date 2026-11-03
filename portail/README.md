# MESSAF-BF — Portail d'administration

Front-End du portail d'administration de MESSAF-BF (Messagerie Sécurisée de l'Administration du Faso). Trois espaces, chacun réservé à son rôle et limité au ministère de l'utilisateur :

| Espace | Rôle | Ce qu'il permet |
|---|---|---|
| Enrôlement | `gestionnaire_rh` | Créer le compte d'un agent et lui remettre sa fiche d'enrôlement |
| Accès des agents | `admin_ministere` | Révoquer immédiatement l'accès d'un agent, ou le rétablir |
| Contrôle | `auditeur` | Lire le journal d'audit du ministère |

`super_admin` voit les trois.

> **Deux modes.** Par défaut, le portail fonctionne en **démonstration** : connexion fictive, données fictives, créations simulées dans le navigateur, aucun compte créé. Branché sur **Keycloak et l'API d'administration** (voir « Raccordement à Keycloak et à l'API »), il crée de vrais comptes : identifiant Matrix réservé, fiche d'enrôlement avec un vrai code d'activation.

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
| `100003` | Mariam Traoré, `gestionnaire_rh`, Santé | Enrôlement des agents de la Santé |
| `100002` | Paul Zongo, `admin_ministere`, Santé | Révocation et réactivation des agents de la Santé |
| `100009` | Salif Ouattara, `auditeur`, Santé | Journal d'audit de la Santé |
| `100011` | Boukary Nikéma, `admin_ministere`, Finances | Cloisonnement : aucun agent de la Santé visible |
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

Révocation (moins d'une minute) : se connecter avec `100002` / `demo`, ouvrir **Fatimata DIALLO**, cliquer sur **Révoquer l'accès**, saisir un motif et confirmer. Puis se connecter avec `100009` / `demo` : la révocation apparaît en tête du **Journal d'audit**, avec son motif. Le tableau de bord de l'enrôlement permet d'effacer les essais.

## Technologies

| Dépendance | Version | Licence | Rôle |
|---|---|---|---|
| [React](https://react.dev) | 19 | MIT | Interface |
| [React Router](https://reactrouter.com) | 7 | MIT | Navigation et routes protégées |
| [React Hook Form](https://react-hook-form.com) | 7 | MIT | Formulaires |
| [Zod](https://zod.dev) | 4 | MIT | Validation des saisies |
| [@hookform/resolvers](https://github.com/react-hook-form/resolvers) | 5 | MIT | Lien Zod ↔ React Hook Form |
| [jsPDF](https://github.com/parallax/jsPDF) | 4 | MIT | Fiche PDF de démonstration uniquement, chargée à la demande |
| [keycloak-js](https://www.keycloak.org/securing-apps/javascript-adapter) | 26.2.4 | Apache-2.0 | Connexion Keycloak (code d'autorisation avec PKCE), renouvellement du jeton |
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
│   ├── agents.api.ts          implémentation réelle (GET/POST /agents, GET /agents/{matricule}, fiche PDF)
│   ├── referentiel.*.ts       organigramme et postes, lecture seule (GET /structures, GET /postes)
│   ├── audit.*.ts             journal d'audit, lecture seule (GET /audit)
│   ├── auth.service.ts        interface + choix démo/Keycloak
│   ├── auth.keycloak.ts       connexion Keycloak (keycloak-js, PKCE, renouvellement du jeton)
│   └── demo/                  SIMULATIONS : auth, agents, référentiel, fiche PDF
├── mocks/         données fictives (jeu commun de la section 10, organigramme, comptes)
├── validation/    schémas Zod des quatre étapes
├── contexts/      AuthContext (session), ReferentielContext (organigramme du ministère)
├── hooks/         useAsync, useAgents, useReferentiel, useFicheEnrolement
├── components/    layout/, navigation/ (route protégée, rôle exigé, menu), forms/, tables/, ui/,
│                  agents/ (parcours, résumé, fiche, accès et révocation)
└── pages/         AccueilPage (selon le rôle), auth/ConnexionPage, dashboard/TableauDeBordPage,
                   agents/ (liste, détail, création, confirmation), audit/JournalAuditPage
```

Règles suivies :

- **Aucun appel HTTP dans les composants.** Les pages passent par `agentsService`, `referentielService` et `authService`. Ces services choisissent eux-mêmes l'implémentation démo ou réelle.
- **Les quatre objets du modèle restent séparés** : identité, profil, poste et affectation, avec un type par objet, un bloc par objet à l'écran et une section par objet dans le corps envoyé à l'API. L'habilitation et l'état sont des attributs du compte.
- Les valeurs techniques exactes sont transmises (`normal`, `diffusion_restreinte`, `confidentiel`). Seuls les libellés sont en français.

## Écrans

| Route | Écran |
|---|---|
| `/connexion` | Connexion (démo : identifiant et mot de passe fictifs ; Keycloak : redirection) |
| `/` | Selon le rôle : tableau de bord de l'enrôlement, liste des agents (administrateur) ou journal d'audit (auditeur) |
| `/agents` | Liste : recherche par matricule ou nom (sans tenir compte des accents), filtres direction et état ; tableau sur grand écran, cartes sur petit écran |
| `/agents/:matricule` | Fiche détaillée : les 4 objets ; fiche d'enrôlement (RH) ; carte « Accès à MESSAF » avec révocation et réactivation, motif obligatoire (administrateur) |
| `/agents/nouveau` | Parcours en 5 étapes : identité, profil, poste et affectation, habilitation, récapitulatif |
| `/agents/:matricule/creation-confirmee` | Confirmation : identifiant Matrix, informations clés, fiche PDF |
| `/audit` | Journal d'audit : date, auteur, action, agent concerné, résultat (réussi, refusé, échec) et détail ; filtres par action et par résultat |

Toutes les routes, sauf `/connexion`, exigent une session et un rôle du portail ; chaque page vérifie ensuite le sien (`config/messaf.ts`, `components/navigation/ExigerRole.tsx`). Ce contrôle n'est qu'un confort d'affichage : **seule l'API protège réellement les données**, en vérifiant le rôle et le ministère.

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
- **Révocation et journal** (`services/demo/agents.demo.ts`, `services/demo/journal.demo.ts`) : les états et le journal sont simulés dans le `localStorage`. Le journal part de quelques entrées fictives et reçoit ensuite chaque création, fiche, révocation et réactivation faite pendant les essais.
- **Fiche d'enrôlement** (`services/demo/fiche.demo.ts`) : PDF généré dans le navigateur. Il porte la mention « DOCUMENT DE DÉMONSTRATION — NON VALABLE POUR UN ENRÔLEMENT RÉEL » et **ne contient aucun code d'activation**.
- Adresses fictives en `.messaf.example`, un domaine réservé qui n'est jamais attribué.

## Raccordement à Keycloak et à l'API

Prérequis : la pile Docker du dépôt démarrée (`docker compose up -d` à la racine). Keycloak répond sur http://localhost:8180 et l'API sur http://localhost:8000.

1. Créer `portail/.env.local` :
   ```
   VITE_DATA_SOURCE=api
   VITE_AUTH_MODE=keycloak
   VITE_API_BASE_URL=http://localhost:8000
   VITE_KEYCLOAK_URL=http://localhost:8180
   VITE_KEYCLOAK_REALM=messaf
   VITE_KEYCLOAK_CLIENT_ID=portail
   ```
2. `npm install`, puis `npm run dev` (port 5173 ; 5174 est aussi accepté par Keycloak et par l'API).
3. Se connecter avec un compte du domaine `messaf`, par exemple `100003` (Mariam Traoré, `gestionnaire_rh`, Santé) : mot de passe et code à 6 chiffres, saisis sur la page de Keycloak.

Le bandeau « MODE DÉMONSTRATION » disparaît. Le portail ne voit jamais le mot de passe ni le code à 6 chiffres.

### Connexion (`services/auth.keycloak.ts`)

- Client public `portail`, flux « Authorization Code » avec PKCE (S256) : aucun secret dans le navigateur.
- Au chargement, une vérification silencieuse (iframe vers `public/silent-check-sso.html`) reprend la session Keycloak sans redirection visible.
- Le jeton d'accès dure 5 minutes. Il est renouvelé avant chaque appel à l'API quand il lui reste moins de 30 secondes. Si la session Keycloak a pris fin (30 minutes d'inactivité, déconnexion, compte révoqué), le portail revient à la page de connexion.
- Les jetons restent en mémoire, jamais dans le `localStorage`.
- « Déconnexion » ferme aussi la session Keycloak.

### Routes utilisées (`services/agents.api.ts`, `services/referentiel.api.ts`, `services/audit.api.ts`)

| Écran | Route |
|---|---|
| Organigramme et postes du formulaire | `GET /structures?ministere=…`, `GET /postes?ministere=…` |
| Tableau de bord, liste | `GET /agents?ministere=…` |
| Fiche détaillée | `GET /agents/{matricule}` |
| Vérification du matricule (étape Identité) | `GET /agents/{matricule}` : 404 = libre |
| Création | `POST /agents` |
| Fiche d'enrôlement | `GET /agents/{matricule}/fiche-enrolement` |
| Révocation, réactivation | `POST /agents/{matricule}/revocation`, `POST /agents/{matricule}/reactivation`, corps `{"motif": "…"}` |
| Journal d'audit | `GET /audit?ministere=…&limite=200` |

Contrat complet : `api/openapi.yaml`, ou http://localhost:8000/docs. Les erreurs arrivent au format `{message, code, champs}`, en français. Le récapitulatif affiche le détail de chaque champ refusé.

Chaque téléchargement de la fiche tire un **nouveau** code d'activation et annule le précédent : ne télécharger la fiche qu'au moment de la remettre. Une fois le compte activé, la fiche détaillée affiche « Compte activé » au lieu du bouton.

## Valeurs convenues avec l'API

| Sujet | Valeur | Où |
|---|---|---|
| Corps de `POST /agents` | Sections `identite` / `profil` / `habilitation` / `affectation`, champs en snake_case | `services/agents.api.ts` |
| Erreurs | `{message, code, champs}` ; 409 `matricule_existant`, `deja_active`, `compte_revoque` ; 422 `donnees_invalides` | `services/api.ts` |
| Format du matricule | 6 chiffres | `config/messaf.ts` |
| Attributs `ministere`, `direction`, `service` | Codes de structure (`sante`, `sante-dh`…) | `types/profile.ts` |
| Rôles par espace | Enrôlement : `gestionnaire_rh` ; consultation des agents : `gestionnaire_rh`, `admin_ministere` ; révocation : `admin_ministere` ; journal : `auditeur` ; `super_admin` partout | `config/messaf.ts` |
| Contenu du jeton | Rôles dans `realm_access.roles` ; `matricule`, `ministere`, `habilitation` ajoutés par le client `portail` | `auth.keycloak.ts` |
| Client Keycloak | Domaine `messaf`, client public `portail` | `.env.example` |
| État d'un compte créé | `actif`, enrôlement `en_attente` jusqu'à la première connexion | `agents.api.ts` |

## Hors périmètre de cette version

Messagerie, gestion des rôles, espace super-administrateur dédié, gestion des structures et des postes, passation et intérim, suspension, convocations, suivi des actions, application Android, chiffrement, configuration de Keycloak, Synapse et PostgreSQL.
