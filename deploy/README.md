# deploy

Configuration de la pile serveur. Le fichier `docker-compose.yml` est à la racine du dépôt pour que tout démarre en une seule commande. Responsable : Axel.

| Fichier | Rôle |
| --- | --- |
| `postgres/init.sql` | Crée les bases `synapse` (collation C, exigée par Synapse) et `keycloak` au premier démarrage |
| `synapse/homeserver.yaml` | Configuration de Synapse, sans aucun secret |
| `synapse/log.config` | Journaux de Synapse vers la console (`docker compose logs`) |

## Démarrer (jalon 0)

Depuis la racine du dépôt, sous Windows (cmd) :

```
copy .env.example .env
notepad .env
docker compose up -d
docker compose ps
```

Dans `.env`, renseignez au moins `POSTGRES_PASSWORD` et `KEYCLOAK_ADMIN_PASSWORD`.

## Vérifier

| Adresse | Résultat attendu |
| --- | --- |
| http://localhost:8008/_matrix/client/versions | Une liste de versions : Synapse répond |
| http://localhost:8008/_matrix/federation/v1/version | Erreur 404 : la fédération est fermée |
| http://localhost:8180 | Console d'administration de Keycloak |
| http://localhost:8090 | Page d'accueil de ntfy |

## Créer deux comptes de test

L'inscription libre est fermée : les comptes se créent avec le secret d'enregistrement du serveur.

```
docker compose exec synapse register_new_matrix_user -c /config/homeserver.yaml -u m100005 -p MotDePasseDemo1 --no-admin http://localhost:8008
docker compose exec synapse register_new_matrix_user -c /config/homeserver.yaml -u m100006 -p MotDePasseDemo2 --no-admin http://localhost:8008
```

Synapse refuse les identifiants composés uniquement de chiffres : le matricule est précédé de la lettre `m`.

## Connecter l'application Android

- **Émulateur Android** : adresse du serveur `http://10.0.2.2:8008`.
- **Téléphone branché en USB** : lancez `adb reverse tcp:8008 tcp:8008`, puis utilisez `http://localhost:8008` sur le téléphone.

Element X n'accepte le HTTP non chiffré que vers ces adresses locales. Pour un téléphone en Wi-Fi, il faudra un accès HTTPS (jalon suivant).

## Arrêter

```
docker compose down       # arrête, les données sont conservées
docker compose down -v    # arrête et efface toutes les données
```
