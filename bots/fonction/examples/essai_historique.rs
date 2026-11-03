//! Essai : le bot crée un salon de fonction chiffré, le sortant et un correspondant y échangent,
//! puis le bot fait la passation. Le successeur doit lire l'historique (MSC4268), le sortant non.
//!
//! Usage : essai_historique <homeserveur> <dossier des jetons> <dossier des magasins>
use std::{
    path::{Path, PathBuf},
    time::Duration,
};

use anyhow::{Context, Result, bail};
use matrix_sdk::{
    Client, Room, RoomState, SessionMeta, SessionTokens,
    authentication::matrix::MatrixSession,
    config::SyncSettings,
    room::MessagesOptions,
    ruma::{
        OwnedRoomId, OwnedUserId,
        api::client::room::create_room::v3::{Request as CreerSalon, RoomPreset},
        events::{
            AnyInitialStateEvent, InitialStateEvent,
            room::{
                encryption::RoomEncryptionEventContent,
                history_visibility::{HistoryVisibility, RoomHistoryVisibilityEventContent},
                message::RoomMessageEventContent,
            },
        },
        serde::Raw,
    },
    store::RoomLoadSettings,
};
use serde_json::json;

async fn connecter(hs: &str, jetons: &Path, magasins: &Path, nom: &str, appareil: &str) -> Result<Client> {
    let jeton = std::fs::read_to_string(jetons.join(nom))?.trim().to_owned();
    let client = Client::builder()
        .homeserver_url(hs)
        .sqlite_store(magasins.join(nom), None)
        .build()
        .await?;
    let user_id: OwnedUserId = format!("@{nom}:gov.bf").try_into()?;
    client
        .matrix_auth()
        .restore_session(
            MatrixSession {
                meta: SessionMeta {
                    user_id,
                    device_id: appareil.into(),
                },
                tokens: SessionTokens {
                    access_token: jeton,
                    refresh_token: None,
                },
            },
            RoomLoadSettings::default(),
        )
        .await?;
    synchro(&client).await?;
    client
        .encryption()
        .bootstrap_cross_signing_if_needed(None)
        .await
        .context("signature croisée")?;
    synchro(&client).await?;
    Ok(client)
}

async fn synchro(c: &Client) -> Result<()> {
    c.sync_once(SyncSettings::default().timeout(Duration::from_millis(500)))
        .await?;
    Ok(())
}

async fn salon(c: &Client, id: &OwnedRoomId) -> Result<Room> {
    for _ in 0..20 {
        synchro(c).await?;
        if let Some(r) = c.get_room(id) {
            return Ok(r);
        }
    }
    bail!("salon {id} introuvable pour {}", c.user_id().unwrap())
}

/// Les messages texte du salon, du plus ancien au plus récent, déchiffrés si possible.
async fn lire(room: &Room) -> Result<Vec<String>> {
    let mut lus = vec![];
    let reponse = room.messages(MessagesOptions::backward()).await?;
    for ev in reponse.chunk.iter().rev() {
        let v: serde_json::Value = ev.raw().deserialize_as()?;
        match v["type"].as_str() {
            Some("m.room.message") => lus.push(format!(
                "{} : {}",
                v["sender"].as_str().unwrap_or("?"),
                v["content"]["body"].as_str().unwrap_or("")
            )),
            Some("m.room.encrypted") => lus.push(format!("{} : [illisible]", v["sender"].as_str().unwrap_or("?"))),
            _ => {}
        }
    }
    Ok(lus)
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or("warn".into()))
        .init();
    let args: Vec<String> = std::env::args().collect();
    let (hs, jetons, magasins) = (&args[1], PathBuf::from(&args[2]), PathBuf::from(&args[3]));

    let bot = connecter(hs, &jetons, &magasins, "bot-fonction", "BOTFONCTION").await?;
    let awa = connecter(hs, &jetons, &magasins, "m100005", "ESSAIAWA").await?;
    let moussa = connecter(hs, &jetons, &magasins, "m100007", "ESSAIMOUSSA").await?;
    let issa = connecter(hs, &jetons, &magasins, "m100006", "ESSAIISSA").await?;
    println!("1. Quatre clients connectés, signature croisée en place");

    // Salon de fonction : chiffré, historique partagé avec les membres
    let mut demande = CreerSalon::new();
    demande.name = Some("FCT-DRH-SANTE · SANTE-DH".into());
    demande.preset = Some(RoomPreset::PrivateChat);
    demande.invite = vec![awa.user_id().unwrap().to_owned(), moussa.user_id().unwrap().to_owned()];
    demande.initial_state = vec![
        InitialStateEvent::with_empty_state_key(RoomEncryptionEventContent::with_recommended_defaults()).to_raw_any(),
        InitialStateEvent::with_empty_state_key(RoomHistoryVisibilityEventContent::new(HistoryVisibility::Shared))
            .to_raw_any(),
        Raw::<AnyInitialStateEvent>::from_json_string(
            json!({"type": "bf.messaf.salon", "state_key": "", "content": {"type": "fonction", "poste": "DRH-SANTE", "archive": true}})
                .to_string(),
        )?,
    ];
    let room_bot = bot.create_room(demande).await?;
    let id = room_bot.room_id().to_owned();
    println!("2. Salon créé par le bot : {id}");

    for c in [&awa, &moussa] {
        salon(c, &id).await?.join().await?;
    }
    synchro(&bot).await?;
    let r_moussa = salon(&moussa, &id).await?;
    let r_awa = salon(&awa, &id).await?;
    r_moussa
        .send(RoomMessageEventContent::text_plain(
            "Au DRH : merci de me transmettre le dossier de Mme Diallo.",
        ))
        .await?;
    synchro(&awa).await?;
    r_awa
        .send(RoomMessageEventContent::text_plain(
            "Bien reçu, je vous l'envoie demain.",
        ))
        .await?;
    for c in [&bot, &moussa, &awa] {
        synchro(c).await?;
    }
    println!("3. Échange avant la passation :");
    for l in lire(&salon(&bot, &id).await?).await? {
        println!("   (vu par le bot) {l}");
    }

    // Passation : invitation du successeur (historique transmis), retrait de la sortante
    let issa_id = issa.user_id().unwrap().to_owned();
    room_bot
        .invite_user_by_id(&issa_id)
        .await
        .context("invitation avec historique")?;
    room_bot
        .kick_user(awa.user_id().unwrap(), Some("Passation de service"))
        .await?;
    room_bot
        .send(RoomMessageEventContent::notice_plain(
            "Passation de service : M. Sawadogo remplace Mme Ouédraogo à compter du 3 novembre 2026.",
        ))
        .await?;
    println!("4. Passation faite par le bot");

    let r_issa = salon(&issa, &id).await?;
    if r_issa.state() == RoomState::Invited {
        r_issa.join().await?;
    }
    for _ in 0..6 {
        synchro(&issa).await?;
    }
    println!("5. Le successeur lit :");
    let lus = lire(&salon(&issa, &id).await?).await?;
    for l in &lus {
        println!("   {l}");
    }

    synchro(&moussa).await?;
    r_moussa
        .send(RoomMessageEventContent::text_plain("Message après la passation."))
        .await?;
    synchro(&awa).await?;
    let etat_awa = awa.get_room(&id).map(|r| r.state());
    // Le serveur montre à un ancien membre les messages d'avant son départ, jamais les suivants
    let vus_par_awa = lire(&r_awa).await.unwrap_or_default();
    let voit_la_suite = vus_par_awa.iter().any(|l| l.contains("après la passation"));
    println!("6. La sortante : état {etat_awa:?}, voit les messages postérieurs : {voit_la_suite}");

    let historique_ok =
        lus.iter().any(|l| l.contains("dossier de Mme Diallo")) && lus.iter().any(|l| l.contains("Bien reçu"));
    println!("\nRésultat : historique transmis = {historique_ok}");
    Ok(())
}
