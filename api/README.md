# api

API d'administration de MESSAF, en Python (FastAPI). Elle crée et enrôle les agents dans Keycloak, émet leur fiche d'enrôlement, les révoque (Keycloak et MAS) et tient le journal d'audit. Le portail de Lionnel est son seul client. Responsable : Axel.

- Contrat : `openapi.yaml`, généré depuis le code. Documentation interactive : http://localhost:8000/docs
- Démarrage : avec le reste de la pile, `docker compose up -d --build` à la racine du dépôt.

## Authentification

Chaque appel porte le jeton Keycloak de l'utilisateur connecté au portail : `Authorization: Bearer <jeton>`. Le jeton vient du client `portail` du domaine `messaf` (flux « Authorization Code » avec PKCE). L'API vérifie sa signature, son émetteur (`http://localhost:8180/realms/messaf`), son audience (`api-messaf`) et son expiration.

Elle lit dans le jeton :
- les rôles, dans `realm_access.roles` ;
- le ministère de l'utilisateur, dans `ministere` (son périmètre) ;
- son matricule, dans `matricule` et `preferred_username`.

## Routes

| Méthode et adresse | Usage | Rôles (dans leur ministère) |
| --- | --- | --- |
| `GET /sante` | L'API répond | aucun |
| `GET /moi` | L'utilisateur tel que l'API le voit | tout utilisateur connecté |
| `GET /structures?ministere=sante` | Le ministère, ses directions et ses services | `gestionnaire_rh`, `admin_ministere` |
| `GET /postes?ministere=sante` | Les postes du ministère | `gestionnaire_rh`, `admin_ministere` |
| `GET /agents?ministere=sante` | Les agents du ministère | `gestionnaire_rh`, `admin_ministere` |
| `GET /agents/{matricule}` | Un agent | `gestionnaire_rh`, `admin_ministere` |
| `POST /agents` | Créer un agent (201, ou 409 si le matricule existe) | `gestionnaire_rh` |
| `GET /agents/{matricule}/fiche-enrolement` | Fiche PDF avec un **nouveau** code d'activation | `gestionnaire_rh` |
| `POST /agents/{matricule}/revocation` | Révoquer : Keycloak bloqué, sessions MAS fermées | `admin_ministere` |
| `POST /agents/{matricule}/reactivation` | Rendre l'accès | `admin_ministere` |
| `GET /audit?limite=100` | Journal d'audit | `auditeur` |

`super_admin` a tous les droits, sur tous les ministères. Le paramètre `ministere` vaut par défaut celui de l'utilisateur ; un autre ministère est refusé (403), sauf pour `super_admin`.

## Formats

Les noms techniques sont en minuscules, sans accents, comme le portail les a préparés (`services/agents.api.ts`).

**Créer un agent**, `POST /agents` :
```json
{
  "identite": {"matricule": "100012", "nom": "Yaméogo", "prenoms": "Rasmané",
               "email": "rasmane.yameogo@sante.messaf.example", "telephone": null},
  "profil": {"ministere": "sante", "direction": "sante-dh", "service": "sante-dh-sqs",
             "annuaire": {"email": true, "telephone": false}},
  "habilitation": "diffusion_restreinte",
  "affectation": {"poste": "CS-SQS-SANTE", "date_debut": "2026-11-03", "date_fin": null}
}
```
Réponse 201 : `{"matricule", "matrix_id", "etat", "enrolement", "cree_le"}`. L'API vérifie que la direction appartient au ministère, le service à la direction, et le poste au ministère.

**Un agent** (`GET /agents`, `GET /agents/{matricule}`) : `identite`, `profil`, `habilitation`, `etat` (`actif`, `suspendu`, `revoque`), `matrix_id`, `enrolement` (`en_attente` tant que l'agent n'a pas fait sa première connexion, puis `termine`), `affectation`, `poste` et `cree_le`.

**Erreurs** : `{"message": "...", "code": "...", "champs": {"identite.matricule": "Format invalide."}}`, en français. Les codes possibles :
- `non_authentifie` (401) et `interdit` (403) ;
- `introuvable` (404) et `donnees_invalides` (422) ;
- `matricule_existant`, `deja_active`, `compte_revoque` et `auto_revocation` (409) ;
- `service_indisponible` et `revocation_partielle` (503).

## Enrôlement

1. Le gestionnaire RH crée l'agent : le compte Keycloak existe, sans mot de passe.
2. Il télécharge la fiche d'enrôlement : l'API tire un code d'activation de 12 caractères, en fait le mot de passe provisoire du compte, puis l'imprime sur le PDF. Le code n'est conservé nulle part ailleurs. Chaque nouveau téléchargement annule le code précédent.
3. Il remet la fiche en main propre. L'agent se connecte avec son matricule et ce code. Keycloak impose alors un mot de passe personnel, le code TOTP et les codes de secours.
4. Dès cette première connexion, la fiche n'est plus disponible (409 `deja_active`).

## Révocation

`POST /agents/{matricule}/revocation`, avec un corps facultatif `{"motif": "..."}` :
1. **Keycloak** : compte désactivé, attribut `etat` à `revoque`. Aucune nouvelle connexion n'est possible.
2. **MAS** : compte verrouillé, puis toutes ses sessions fermées : applications, navigateur et jetons personnels qui agissent en son nom. L'application affiche « Device removed » en deux minutes au plus.
3. **Keycloak** : ses propres sessions fermées.

Réponse : `{"matricule", "etat": "revoque", "sessions_fermees"}`, le nombre de sessions MAS fermées. Les sessions MAS sont fermées avant celles de Keycloak : sinon Keycloak prévient MAS, qui ferme lui-même les sessions ouvertes depuis cette connexion, et le nombre renvoyé ne compte plus que le reste.

Si MAS ne répond pas, l'API renvoie 503 `revocation_partielle` : le compte est déjà bloqué dans Keycloak, et la révocation peut être relancée sans risque.

## Journal d'audit

Chaque création, émission de fiche, révocation et réactivation est inscrite, ainsi que chaque refus d'accès à ces actions. Une ligne indique l'auteur, l'action, la cible, le ministère, le résultat et le détail. La table est en ajout seul : des déclencheurs PostgreSQL refusent toute modification et toute suppression, y compris le vidage d'un coup (`TRUNCATE`). Limite : un administrateur de la base peut retirer ces déclencheurs ; en production, l'API se connecterait avec un rôle qui n'a que les droits d'ajout et de lecture sur cette table.

## Brancher le portail

Dans `portail/.env.local` :
```
VITE_DATA_SOURCE=api
VITE_AUTH_MODE=keycloak
VITE_API_BASE_URL=http://localhost:8000
VITE_KEYCLOAK_URL=http://localhost:8180
VITE_KEYCLOAK_REALM=messaf
VITE_KEYCLOAK_CLIENT_ID=portail
```
Keycloak accepte le portail sur `http://localhost:5173` et `http://localhost:5174`.

## Données de démonstration

Avec `MESSAF_DEMO=1` (réglage de `docker-compose.yml`), l'API charge au démarrage l'organigramme et les postes fictifs du portail, ainsi que les affectations des 11 comptes de démonstration. Elle ne remplace rien de ce qui existe déjà.

## Dépendances

| Paquet | Licence | Rôle |
| --- | --- | --- |
| FastAPI, Uvicorn, Pydantic | MIT, BSD | Serveur web et validation |
| httpx | BSD | Appels à Keycloak et à MAS |
| PyJWT, cryptography | MIT, Apache-2.0/BSD | Vérification des jetons |
| psycopg, psycopg-pool | LGPL-3.0 | PostgreSQL |
| fpdf2 | LGPL-3.0 | Fiche d'enrôlement PDF |
