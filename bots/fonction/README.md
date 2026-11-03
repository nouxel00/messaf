# Bot de fonction

Le compte `@bot-fonction:gov.bf` gère les **salons de fonction** : on écrit au « DRH de la Santé », pas seulement à une personne. Quand le titulaire change, le bot fait entrer le successeur dans les salons de la fonction, avec leur historique chiffré, et en fait sortir l'ancien titulaire. Pendant une absence, il ouvre un accès limité à l'intérimaire. Responsable : Axel.

Écrit en Rust avec [matrix-rust-sdk](https://github.com/matrix-org/matrix-rust-sdk), la bibliothèque d'Element X : même chiffrement (vodozemac), même partage de l'historique.

## Qui décide, qui exécute

L'**API d'administration** décide : droits, habilitation, dates, registre des passations et des absences, journal d'audit. Le **bot** exécute dans Matrix et rend compte, salon par salon. Il n'écoute que l'API, sur une API interne joignable seulement dans le réseau Docker et protégée par un secret partagé (`/secrets/bot_interne`, comparé en temps constant).

| Route interne | Ordre |
| --- | --- |
| `POST /interne/salons` | Créer un salon de fonction chiffré entre deux fonctions |
| `POST /interne/passation` | Passation de service |
| `POST /interne/interim` | Ouverture d'un intérim |
| `POST /interne/fin-interim` | Clôture d'un intérim |
| `POST /interne/etat` | Réécriture de l'état `bf.messaf.salon` de salons existants (niveau de classification, resynchronisation) |
| `GET /interne/sante` | État du bot et de sa signature croisée |

## Passation de service

1. Le bot prépare le **dossier de passation** pendant qu'il lit encore tout : pour chaque salon, le volume d'échanges, le dernier échange et les messages restés sans réponse du sortant.
2. Il **invite le successeur avec l'historique** : les clés des anciens messages lui sont transmises au moment de l'invitation (partage de l'historique, MSC4268, Matrix 1.19). Le successeur relit tout le fil de la fonction.
3. Il **retire le sortant**. Les clés du salon sont renouvelées au message suivant : le sortant ne lit plus rien de nouveau.
4. Il publie un **avis** dans chaque salon et met à jour l'état `bf.messaf.salon` (fonctions, titulaires, intérimaires), que l'application lit pour afficher « en qualité de ».
5. Il remet le dossier au successeur, dans un salon chiffré où lui seul est invité.

Mutation : si le successeur occupait déjà un poste, il quitte aussi les salons de cette ancienne fonction. Un agent n'est jamais retiré d'un salon où il reste membre à un autre titre, par exemple comme titulaire de la fonction d'en face.

## Intérim

L'intérimaire est invité **sans l'historique** (moindre privilège) : il lit les messages postérieurs à son arrivée, plus un dossier « Affaires en cours » (messages en attente de réponse). À la fin, il est retiré et le titulaire reçoit un compte rendu : messages reçus et réponses de l'intérimaire pendant la période.

## Démarrage

Avec le reste de la pile : `docker compose up -d` à la racine du dépôt.

- Le service `bot-init` crée une seule fois le compte du bot dans MAS, puis un jeton personnel lié à un appareil propre au bot (`api/outils/jeton_bot.py`). Il ne refait rien si le jeton existe.
- Le bot ouvre sa session, crée sa signature croisée au premier démarrage, puis écoute l'API sur le port 8090 (non publié).
- Avec `MESSAF_DEMO=1`, l'API lui fait créer deux salons fictifs : `FCT-DRH-SANTE · DH-SANTE` et `FCT-DRH-SANTE · SG-SANTE`.

L'image est compilée par GitHub Actions (`.github/workflows/bot-fonction.yml`) et publiée sur `ghcr.io/nouxel00/messaf-bot-fonction`. Sans accès à cette image, Docker la compile sur place (compter environ 15 minutes et 3 Go de mémoire).

Vérifier :
```
docker compose logs bot-fonction
```
La ligne `bot de fonction connecté` doit apparaître, sans erreur `signature croisée incomplète`.

## Données à conserver

Le volume `bot_donnees` contient le magasin chiffré des clés du bot (phrase de chiffrement : `/secrets/bot_fonction_magasin`). Le perdre, c'est perdre la capacité de transmettre l'historique aux successeurs.

Si ce volume est effacé alors que le compte du bot existe encore, la signature croisée ne peut pas être refaite : effacer aussi le jeton (`bot_fonction_jeton` et `bot_fonction_appareil` dans le volume `secrets`), puis relancer `bot-init` et le bot. Le plus simple reste `docker compose down -v`, qui repart de zéro.

## Limites connues

- Le bot est membre de tous les salons de fonction : il détient leurs clés. C'est un composant de confiance, à protéger comme le serveur.
- L'historique n'est transmis qu'aux appareils vérifiés par signature croisée (règle de matrix-rust-sdk). Un successeur dont la session n'est pas vérifiée voit les anciens messages sans pouvoir les lire.
- Les limites de débit de Synapse ralentissent une passation qui touche beaucoup de salons (prototype : deux salons).

## Développement

```
cargo test
cargo clippy --all-targets
```
`examples/essai_historique.rs` reproduit la passation avec deux comptes d'essai, `examples/client_essai.rs` est un client minimal (lire, écrire, rejoindre) pour vérifier ce que voit chaque agent.

## Dépendances

| Paquet | Licence | Rôle |
| --- | --- | --- |
| [matrix-sdk](https://github.com/matrix-org/matrix-rust-sdk) 0.19 | Apache-2.0 | Client Matrix, chiffrement, partage de l'historique |
| [tokio](https://tokio.rs) | MIT | Exécution asynchrone |
| [axum](https://github.com/tokio-rs/axum) | MIT | API interne |
| [serde](https://serde.rs), serde_json | MIT / Apache-2.0 | Lecture et écriture JSON |
| [anyhow](https://github.com/dtolnay/anyhow) | MIT / Apache-2.0 | Erreurs |
| [tracing](https://github.com/tokio-rs/tracing) | MIT | Journaux |
