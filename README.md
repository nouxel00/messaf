# MESSAF – Messagerie sécurisée de l'administration du Faso

Messagerie instantanée chiffrée de bout en bout, hébergée sur l'infrastructure de l'État et réservée aux agents enrôlés.
Projet de l'équipe **Challengers** (Institut Supérieur de Génie Électrique du Burkina Faso) pour le sprint technique du Hackathon 226 – Édition 2026.

> Dépôt en construction : ce README sera complété au fil du sprint (deux pages au maximum).

## Concept

MESSAF suit les fonctions administratives, pas seulement les personnes. On écrit au « DRH du ministère de la Santé » ; en cas de mutation ou de congé, le successeur ou l'intérimaire reprend le fil, et le service continue.

## Organisation du dépôt

| Dossier | Contenu | Responsable |
| --- | --- | --- |
| `deploy/` | Docker Compose, configuration de Synapse, MAS, Keycloak et ntfy | Axel |
| `api/` | API d'administration (Python) et `openapi.yaml` | Axel |
| `portail/` | Portail d'administration (React) | Lionnel |
| `bots/fonction/` | Bot de fonction : passations, intérims | Axel |
| `bots/archives/` | Bot archiviste | Axel |
| `tests/` | Tests automatisés des fonctions de sécurité | Axel |
| `demo/` | Jeu de données fictif et script de chargement | Axel |
| `docs/` | Note de pré-projet, note de sécurité | Axel et Lionnel |

L'application Android est un fork d'Element X : [messaf-android](https://github.com/nouxel00/messaf-android).

## Technologies et licences

| Composant | Rôle | Licence | Projet |
| --- | --- | --- | --- |
| Synapse | Serveur Matrix | AGPL-3.0 | https://github.com/element-hq/synapse |
| Element X Android | Application mobile (fork) | AGPL-3.0 | https://github.com/element-hq/element-x-android |
| PostgreSQL | Base de données | PostgreSQL License | https://www.postgresql.org |
| Keycloak | Identité, second facteur, rôles | Apache-2.0 | https://www.keycloak.org |
| Matrix Authentication Service | Sessions des applications, relais vers Keycloak | AGPL-3.0 | https://github.com/element-hq/matrix-authentication-service |
| FastAPI, httpx, PyJWT, psycopg, fpdf2 | API d'administration (détail dans `api/README.md`) | MIT, BSD, LGPL-3.0 | https://fastapi.tiangolo.com |
| FreeOTP | Codes à usage unique | Apache-2.0 | https://freeotp.github.io |
| libsodium | Chiffrement des archives | ISC | https://libsodium.org |
| React | Portail d'administration | MIT | https://react.dev |
| ntfy | Notifications Android (UnifiedPush) | Apache-2.0 / GPL-2.0 | https://github.com/binwiederhier/ntfy |
| Docker Compose | Déploiement | Apache-2.0 | https://github.com/docker/compose |

Toute nouvelle dépendance est ajoutée à ce tableau, avec sa licence et le lien de son projet.

## Niveau d'engagement open source

**Étendre et adapter** : MESSAF s'appuie sur Synapse et Element X. Le code de l'équipe est publié sous licence AGPL-3.0 (fichier `LICENSE`).

## Installation

À compléter. Objectif : une seule commande.

```
copy .env.example .env    # puis renseigner les mots de passe
docker compose up -d
```

Détails, vérifications et connexion des téléphones : [deploy/README.md](deploy/README.md).

## Comptes de démonstration

Uniquement des comptes fictifs : matricules `100001` à `100011`, mot de passe provisoire défini dans `.env`, code TOTP configuré à la première connexion. Voir [deploy/README.md](deploy/README.md#comptes-de-démonstration).

## Limites connues

À compléter, en lien avec la note de sécurité.

## Équipe

- SANOU Tolo Thède Axel – infrastructure et sécurité
- OUEDRAOGO Nebwaogo Lionnel – innovation et interfaces
