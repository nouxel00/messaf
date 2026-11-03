# tests

Tests automatisés des fonctions de sécurité, contre la pile en marche. Ils reprennent trois épreuves de l'entretien :

| Épreuve | Ce qui est vérifié |
| --- | --- |
| Le serveur ne lit rien | Tous les salons sont chiffrés de bout en bout ; la base de Synapse ne contient aucun message en clair, seulement des `m.room.encrypted` sans texte |
| Intrus | Inscription fermée ; aucune connexion par mot de passe auprès de Synapse ; fédération fermée ; jeton inconnu refusé ; un agent non invité ne peut pas rejoindre un salon de fonction |
| Révocation | Le compte est désactivé dans Keycloak, ses sessions sont fermées, et son jeton est refusé par Synapse en deux minutes au plus (délai mesuré et affiché) |

Lancement, depuis la racine du dépôt, la pile démarrée :

```
docker compose --profile tests run --rm tests
```

Les tests tournent dans l'image de l'API, à l'intérieur du réseau Docker. Ils n'utilisent que des comptes fictifs : l'agent d'essai est Fatimata Diallo (100008), révoquée puis rétablie ; une autre peut être choisie avec `-e AGENT_ESSAI=<matricule>`. La révocation et le rétablissement sont inscrits au journal d'audit, au nom de `tests-automatises`.
