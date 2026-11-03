# deploy

Configuration de la pile serveur. Le fichier `docker-compose.yml` est à la racine du dépôt pour que tout démarre en une seule commande. Responsable : Axel.

Chaîne de connexion : **application → Synapse → MAS → Keycloak**. Synapse ne voit aucun mot de passe. MAS (Matrix Authentication Service) gère les sessions des applications et confie l'identification à Keycloak : mot de passe, puis code TOTP ou code de secours.

| Fichier | Rôle |
| --- | --- |
| `init/generer-secrets.py` | Génère au premier démarrage les secrets internes dans le volume `secrets` (jamais dans Git) |
| `postgres/init.sql` | Crée les bases `synapse` (collation C), `keycloak` et `mas` au premier démarrage |
| `synapse/homeserver.yaml` | Configuration de Synapse, connexion déléguée à MAS |
| `synapse/log.config` | Journaux de Synapse vers la console (`docker compose logs`) |
| `mas/config.yaml` | Configuration de MAS : Keycloak comme seul fournisseur d'identité, API d'administration réservée à l'API MESSAF |
| `keycloak/realm-messaf.json` | Domaine `messaf` : 11 comptes fictifs, 6 rôles, TOTP et codes de secours obligatoires, clients `mas`, `portail` et `api-messaf` |
| `keycloak/configurer.sh` | Accepte les codes de secours à la connexion, crée le compte de service de l'API et l'audience du portail, y compris sur une installation existante |
| `relier-telephones.bat` | Relie les téléphones branchés en USB aux ports 8008, 8280 et 8180 |

## Démarrer

Depuis la racine du dépôt, sous Windows (cmd) :

```
copy .env.example .env
notepad .env
docker compose up -d
docker compose ps
```

Dans `.env`, renseignez `POSTGRES_PASSWORD`, `KEYCLOAK_ADMIN_PASSWORD` et `MESSAF_DEMO_PASSWORD` (12 caractères minimum).

Au premier démarrage, `secrets` et `keycloak-config` s'exécutent une fois puis s'arrêtent : c'est normal (état `Exited (0)`).

## Vérifier

| Adresse | Résultat attendu |
| --- | --- |
| http://localhost:8008/_matrix/client/versions | Une liste de versions : Synapse répond |
| http://localhost:8008/_matrix/client/v1/auth_metadata | Un document dont `issuer` vaut `http://localhost:8280/` : la connexion passe par MAS |
| http://localhost:8008/_matrix/federation/v1/version | Erreur 404 : la fédération est fermée |
| http://localhost:8180 | Console d'administration de Keycloak (domaine `messaf`) |
| http://localhost:8280/login | MAS renvoie vers la page de connexion de Keycloak (domaine MESSAF) |
| http://localhost:8090 | Page d'accueil de ntfy |
| http://localhost:8000/docs | Documentation de l'API d'administration (les appels exigent un jeton du portail) |

## Comptes de démonstration

Les 11 comptes fictifs du domaine `messaf` ont pour identifiant leur matricule (`100001` à `100011`) et pour mot de passe provisoire `MESSAF_DEMO_PASSWORD`. À la première connexion, Keycloak impose dans l'ordre :

1. un nouveau mot de passe (12 caractères minimum) ;
2. le code TOTP : scanner le QR code avec FreeOTP, Aegis ou Google Authenticator ;
3. les codes de secours : les noter, ils servent une seule fois chacun si le téléphone est perdu.

MAS crée alors le compte Matrix `@m<matricule>:gov.bf`. Aucun compte ne peut être créé autrement : l'inscription est fermée partout.

## Connecter l'application Android

Téléphone branché en USB : lancez `deploy\relier-telephones.bat`, puis saisissez l'adresse `http://localhost:8008` dans l'application. Element X ouvre alors la page de connexion de Keycloak dans le navigateur du téléphone.

Le script relie trois ports, car le téléphone doit joindre Synapse (8008), MAS (8280) et Keycloak (8180). Relancez-le après chaque débranchement.

Sur un téléphone qui a peu de mémoire (Redmi, par exemple), Android ferme la page de connexion ou l'application quand on part chercher le code TOTP. Ouvrez l'application d'authentification en **fenêtre flottante** pour lire le code sans quitter la page, et réglez l'application MESSAF sur « Aucune restriction » de batterie.

Pour enrôler le code TOTP, le plus simple est de faire la première connexion sur l'ordinateur (http://localhost:8280/login) et de scanner le QR code avec le téléphone.

## Révoquer un agent

Depuis le portail, ou par l'API : `POST /agents/{matricule}/revocation`, avec le rôle `admin_ministere`. L'API bloque le compte dans Keycloak, puis le verrouille dans MAS et ferme toutes ses sessions. L'application affiche « Device removed » en deux minutes au plus, le délai de mémoire de Synapse. Voir [api/README.md](../api/README.md).

Le bouton « Sign out » de Keycloak ne suffit pas : Keycloak ferme sa propre session après 30 minutes d'inactivité, et ne peut plus prévenir MAS ensuite.

En secours, sans l'API :
```
docker compose exec mas mas-cli manage lock-user m100008 --config /config/config.yaml
docker compose exec mas mas-cli manage kill-sessions m100008 --config /config/config.yaml
```
Désactivez aussi l'agent dans Keycloak (domaine `messaf`, **Users**, interrupteur **Enabled**). Pour rendre l'accès : `POST /agents/{matricule}/reactivation`, ou `mas-cli manage unlock-user` et la réactivation dans Keycloak.

## Arrêter

```
docker compose down       # arrête, les données sont conservées
docker compose down -v    # arrête et efface toutes les données (comptes, messages, secrets)
```

Le domaine `messaf` n'est importé que s'il n'existe pas encore. Après une modification de `realm-messaf.json`, il faut repartir de zéro avec `docker compose down -v`.
