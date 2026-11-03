//! Client Matrix de test, pour vérifier de bout en bout ce que voit un agent (déchiffrement compris).
//!
//! client_essai <homeserveur> <utilisateur> <appareil> <fichier du jeton> <magasin> <commande> [arguments]
//!   salons                 : salons où l'agent est membre ou invité
//!   rejoindre <salon>      : accepte l'invitation (et l'historique transmis, s'il y en a)
//!   ecrire <salon> <texte> : envoie un message
//!   lire <salon>           : affiche les messages lisibles
use std::time::Duration;

use anyhow::{Context, Result};
use matrix_sdk::{
    Client, RoomState, SessionMeta, SessionTokens,
    authentication::matrix::MatrixSession,
    config::SyncSettings,
    room::MessagesOptions,
    ruma::{OwnedRoomId, OwnedUserId, events::room::message::RoomMessageEventContent},
    store::RoomLoadSettings,
};

async fn synchro(c: &Client, n: usize) -> Result<()> {
    for _ in 0..n {
        c.sync_once(SyncSettings::default().timeout(Duration::from_millis(700)))
            .await?;
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or("error".into()))
        .init();
    let a: Vec<String> = std::env::args().collect();
    let (hs, utilisateur, appareil, jeton, magasin, commande) = (&a[1], &a[2], &a[3], &a[4], &a[5], a[6].as_str());
    let client = Client::builder()
        .homeserver_url(hs)
        .sqlite_store(magasin, None)
        .build()
        .await?;
    let user_id: OwnedUserId = utilisateur.as_str().try_into()?;
    client
        .matrix_auth()
        .restore_session(
            MatrixSession {
                meta: SessionMeta {
                    user_id,
                    device_id: appareil.as_str().into(),
                },
                tokens: SessionTokens {
                    access_token: std::fs::read_to_string(jeton)?.trim().into(),
                    refresh_token: None,
                },
            },
            RoomLoadSettings::default(),
        )
        .await?;
    synchro(&client, 2).await?;
    client
        .encryption()
        .bootstrap_cross_signing_if_needed(None)
        .await
        .context("signature croisée")?;
    synchro(&client, 2).await?;

    match commande {
        "salons" => {
            for r in client.rooms() {
                println!("{} {:?} {}", r.room_id(), r.state(), r.name().unwrap_or_default());
            }
        }
        "rejoindre" => {
            let id: OwnedRoomId = a[7].as_str().try_into()?;
            let r = client.get_room(&id).context("salon inconnu")?;
            if r.state() != RoomState::Joined {
                r.join().await?;
            }
            synchro(&client, 4).await?;
            println!("rejoint {id}");
        }
        "ecrire" => {
            let id: OwnedRoomId = a[7].as_str().try_into()?;
            let r = client.get_room(&id).context("salon inconnu")?;
            r.send(RoomMessageEventContent::text_plain(&a[8])).await?;
            synchro(&client, 1).await?;
            println!("envoyé");
        }
        "lire" => {
            let id: OwnedRoomId = a[7].as_str().try_into()?;
            let r = client.get_room(&id).context("salon inconnu")?;
            println!("état : {:?}", r.state());
            match r.messages(MessagesOptions::backward()).await {
                Err(e) => println!("lecture refusée : {e}"),
                Ok(m) => {
                    for ev in m.chunk.iter().rev() {
                        let v: serde_json::Value = ev.raw().deserialize_as()?;
                        match v["type"].as_str() {
                            Some("m.room.message") => println!(
                                "  {} : {}",
                                v["sender"].as_str().unwrap_or("?"),
                                v["content"]["body"].as_str().unwrap_or("").replace('\n', "\n      ")
                            ),
                            Some("m.room.encrypted") => {
                                println!("  {} : [illisible]", v["sender"].as_str().unwrap_or("?"))
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
        autre => anyhow::bail!("commande inconnue : {autre}"),
    }
    Ok(())
}
