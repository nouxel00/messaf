# api

API d'administration de MESSAF, en Python (FastAPI). Elle crée et enrôle les agents dans Keycloak, émet leur fiche d'enrôlement, les révoque (Keycloak et MAS) et tient le journal d'audit. Depuis le jalon 2, elle tient aussi le registre des fonctions, des passations de service et des intérims, que le [bot de fonction](../bots/fonction/README.md) exécute dans Matrix. Le portail de Lionnel est son seul client. Responsable : Axel.

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
| `GET /structures?ministere=sante` | Le ministère, ses directions et ses services | `gestionnaire_rh`, `admin_ministere`, `auditeur` |
| `GET /postes?ministere=sante` | Les postes du ministère | `gestionnaire_rh`, `admin_ministere`, `auditeur` |
| `GET /agents?ministere=sante` | Les agents du ministère | `gestionnaire_rh`, `admin_ministere` |
| `GET /agents/{matricule}` | Un agent | `gestionnaire_rh`, `admin_ministere` |
| `POST /agents` | Créer un agent (201, ou 409 si le matricule existe) | `gestionnaire_rh` |
| `GET /agents/{matricule}/fiche-enrolement` | Fiche PDF avec un **nouveau** code d'activation | `gestionnaire_rh` |
| `POST /agents/{matricule}/revocation` | Révoquer : Keycloak bloqué, sessions MAS fermées | `admin_ministere` |
| `POST /agents/{matricule}/reactivation` | Rendre l'accès | `admin_ministere` |
| `GET /audit?limite=100` | Journal d'audit | `auditeur` |
| `GET /fonctions?ministere=sante` | Fonctions : titulaires, intérimaires, salons | `gestionnaire_rh`, `admin_ministere`, `superieur`, `auditeur` |
| `GET /fonctions/{poste}` | Une fonction et l'historique de ses titulaires | idem |
| `POST /fonctions/{poste}/salons` | Créer un salon de fonction avec une autre fonction (`{"interlocuteur": "DH-SANTE", "classification": "diffusion_restreinte"}`) | `admin_ministere` |
| `POST /passations` | Passation de service : exécutée tout de suite si la date d'effet est atteinte, sinon planifiée | `admin_ministere` |
| `GET /passations?ministere=sante` | Registre des passations | `admin_ministere`, `auditeur` |
| `POST /passations/{id}/execution`, `POST /passations/{id}/annulation` | Relancer une passation en échec, annuler une passation planifiée | `admin_ministere` |
| `POST /absences` | Déclarer une absence et proposer un intérimaire | l'agent lui-même, ou `gestionnaire_rh` |
| `GET /absences?ministere=sante` | Absences à valider, en cours et passées | `gestionnaire_rh`, `admin_ministere`, `superieur`, `auditeur` |
| `POST /absences/{id}/validation` | Valider ou refuser l'intérim, éventuellement désigner un autre intérimaire | titulaire du poste supérieur |
| `POST /absences/{id}/fin` | Retour anticipé, ou annulation d'une absence pas encore commencée | l'agent, son supérieur, `gestionnaire_rh` |
| `GET /agents/{matricule}/statut` | Statut (`disponible`, `en_mission`, `en_conge`, `absent`) et intérimaire, pour l'application | tout utilisateur connecté |

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
- jalon 2 : `salon_existant`, `deja_titulaire`, `passation_en_attente`, `passation_terminee`, `passation_future`, `absence_existante`, `absence_traitee` et `absence_terminee` (409) ;
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

## Passations de service

`POST /passations`, corps `{"poste": "DRH-SANTE", "entrant": "100006", "sortant": null, "date_effet": "2026-11-03", "motif": "..."}`. Le sortant est le titulaire actuel ; il n'est à préciser que si le poste en a plusieurs.

L'API vérifie que l'entrant est un agent actif du ministère, habilité pour le poste (`habilitation` au moins égale à `habilitation_requise`), qu'il n'en est pas déjà titulaire et qu'aucune passation n'est déjà prévue. À la date d'effet (tout de suite, ou par le planificateur de l'API, qui passe chaque minute), le bot invite l'entrant dans les salons de la fonction avec leur historique, retire le sortant et remet le dossier de passation. **L'affectation ne change dans la base que si le bot a tout réussi** : sinon la passation est `echec`, et `POST /passations/{id}/execution` la relance sans risque.

C'est une mutation : l'entrant quitte son poste actuel, et les salons de cette fonction. Les dates sont comptées en jours ; deux passations le même jour sur le même poste ne laissent que la dernière affectation, le registre et le journal gardent les deux.

## Salons classés

Un salon de fonction a un niveau : `normal`, `diffusion_restreinte` ou `confidentiel`, au plus l'habilitation requise par chacune de ses deux fonctions. Seuls les agents habilités y sont invités, à la création comme lors d'un intérim ; un successeur l'est forcément, puisqu'il doit être habilité pour le poste. Le niveau est écrit dans l'état `bf.messaf.salon` ; dès la Diffusion restreinte, l'application bloque les captures d'écran et retire le transfert et la copie. Chaque minute, l'API réécrit l'état d'un salon dont la base a changé (niveau, titulaires, intérimaires). Avec `MESSAF_DEMO=1`, le salon DRH ↔ hôpitaux est de niveau normal et le salon DRH ↔ secrétariat général en Confidentiel.

## Absences et intérims

1. L'agent, ou un gestionnaire RH, déclare l'absence (`en_mission`, `en_conge` ou `absent`, dates, précision) et propose un intérimaire : un agent actif de la même direction, habilité pour le poste, et pas lui-même absent sur la période.
2. Le titulaire du poste supérieur valide ou refuse. En validant, il peut désigner un autre intérimaire, même hors de la direction.
3. À la date de début, le bot invite l'intérimaire **sans l'historique** et lui remet les affaires en cours. Si l'intérimaire est lui-même absent, la fonction remonte au titulaire du poste supérieur (trois niveaux au plus).
4. À la date de fin, ou au retour anticipé, le bot retire l'intérimaire et remet un compte rendu au titulaire.

## Journal d'audit

Chaque création, émission de fiche, révocation et réactivation est inscrite, ainsi que chaque refus d'accès à ces actions. Depuis le jalon 2, aussi : création de salon de fonction, passation (planifiée, exécutée, annulée), absence (déclarée, validée ou refusée, annulée), début et fin d'intérim. Une ligne indique l'auteur, l'action, la cible, le ministère, le résultat et le détail. La table est en ajout seul : des déclencheurs PostgreSQL refusent toute modification et toute suppression, y compris le vidage d'un coup (`TRUNCATE`). Limite : un administrateur de la base peut retirer ces déclencheurs ; en production, l'API se connecterait avec un rôle qui n'a que les droits d'ajout et de lecture sur cette table.

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
Keycloak accepte le portail sur `http://localhost:5173` et `http://localhost:5174`. Le détail du raccordement (connexion, renouvellement du jeton, routes utilisées par chaque écran) est dans [portail/README.md](../portail/README.md).

## Données de démonstration

Avec `MESSAF_DEMO=1` (réglage de `docker-compose.yml`), l'API charge au démarrage l'organigramme et les postes fictifs du portail, ainsi que les affectations des 11 comptes de démonstration. Elle ne remplace rien de ce qui existe déjà. Dès que le bot répond, elle lui fait créer deux salons de fonction fictifs : DRH-SANTE avec DH-SANTE, et DRH-SANTE avec SG-SANTE.

## Dépendances

| Paquet | Licence | Rôle |
| --- | --- | --- |
| FastAPI, Uvicorn, Pydantic | MIT, BSD | Serveur web et validation |
| httpx | BSD | Appels à Keycloak, à MAS et au bot de fonction |
| PyJWT, cryptography | MIT, Apache-2.0/BSD | Vérification des jetons |
| psycopg, psycopg-pool | LGPL-3.0 | PostgreSQL |
| fpdf2 | LGPL-3.0 | Fiche d'enrôlement PDF |
