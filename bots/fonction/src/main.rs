//! Bot de fonction de MESSAF (@bot-fonction:gov.bf).
//!
//! Il gère les salons de fonction : création, passations de service, intérims. Il reçoit ses ordres
//! de l'API d'administration par une API interne, joignable seulement à l'intérieur de Docker et
//! protégée par un secret partagé (fichier /secrets/bot_interne).
// Les types asynchrones de matrix-sdk sont profonds : limite relevée pour le compilateur
#![recursion_limit = "256"]

mod matrice;
mod operations;
mod temps;

use std::{sync::Arc, time::Duration};

use anyhow::{Context, Result};
use axum::{
    Json, Router,
    extract::{Request, State},
    http::{StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use matrix_sdk::{
    Client, SessionMeta, SessionTokens, authentication::matrix::MatrixSession, config::SyncSettings, ruma::OwnedUserId,
    store::RoomLoadSettings,
};
use serde::Serialize;
use serde_json::json;
use tracing::{error, info, warn};

use crate::matrice::Bot;

struct Reglages {
    homeserveur: String,
    utilisateur: OwnedUserId,
    appareil_fichier: String,
    jeton_fichier: String,
    magasin: String,
    secret_magasin_fichier: String,
    secret_interne_fichier: String,
    ecoute: String,
}

fn env(nom: &str, defaut: &str) -> String {
    std::env::var(nom).unwrap_or_else(|_| defaut.to_owned())
}

impl Reglages {
    fn lire() -> Result<Self> {
        Ok(Self {
            homeserveur: env("MATRIX_HOMESERVEUR", "http://synapse:8008"),
            utilisateur: env("BOT_UTILISATEUR", "@bot-fonction:gov.bf").try_into()?,
            appareil_fichier: env("BOT_APPAREIL_FICHIER", "/secrets/bot_fonction_appareil"),
            jeton_fichier: env("BOT_JETON_FICHIER", "/secrets/bot_fonction_jeton"),
            magasin: env("BOT_MAGASIN", "/donnees/magasin"),
            secret_magasin_fichier: env("BOT_MAGASIN_SECRET_FICHIER", "/secrets/bot_fonction_magasin"),
            secret_interne_fichier: env("BOT_INTERNE_SECRET_FICHIER", "/secrets/bot_interne"),
            ecoute: env("BOT_ECOUTE", "0.0.0.0:8090"),
        })
    }
}

/// Lit un secret ; attend qu'il existe (il est créé par un service d'initialisation).
async fn secret(chemin: &str) -> Result<String> {
    for essai in 0.. {
        match std::fs::read_to_string(chemin) {
            Ok(s) if !s.trim().is_empty() => return Ok(s.trim().to_owned()),
            _ if essai < 60 => {
                info!("attente du secret {chemin}");
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
            _ => break,
        }
    }
    anyhow::bail!("secret introuvable : {chemin}")
}

async fn connecter(r: &Reglages) -> Result<Client> {
    // Jeton et appareil créés par le service bot-init (api/outils/jeton_bot.py)
    let jeton = secret(&r.jeton_fichier).await?;
    let appareil = secret(&r.appareil_fichier).await?;
    let secret_magasin = secret(&r.secret_magasin_fichier).await?;
    // Magasin d'état et de clés chiffré sur disque : à conserver, sinon le bot perd ses clés
    let client = Client::builder()
        .homeserver_url(&r.homeserveur)
        .sqlite_store(&r.magasin, Some(&secret_magasin))
        .build()
        .await
        .context("création du client Matrix")?;
    client
        .matrix_auth()
        .restore_session(
            MatrixSession {
                meta: SessionMeta {
                    user_id: r.utilisateur.clone(),
                    device_id: appareil.as_str().into(),
                },
                tokens: SessionTokens {
                    access_token: jeton,
                    refresh_token: None,
                },
            },
            RoomLoadSettings::default(),
        )
        .await
        .context("ouverture de la session")?;
    for essai in 1.. {
        match client.sync_once(SyncSettings::default()).await {
            Ok(_) => break,
            Err(e) if essai < 30 => {
                warn!("Synapse pas encore prêt ({e}), nouvel essai");
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
            Err(e) => return Err(e).context("première synchronisation"),
        }
    }
    // Signature croisée : indispensable pour transmettre l'historique à un successeur (MSC4268)
    client
        .encryption()
        .bootstrap_cross_signing_if_needed(None)
        .await
        .context("signature croisée du bot")?;
    let complete = client
        .encryption()
        .cross_signing_status()
        .await
        .is_some_and(|s| s.is_complete());
    if !complete {
        // Cas typique : le volume du bot a été effacé, mais pas son compte sur le serveur
        error!(
            "signature croisée incomplète : le bot ne pourra pas transmettre l'historique aux successeurs. \
             Si le volume du bot a été effacé, effacez aussi son jeton (bot_fonction_jeton) pour repartir proprement."
        );
    }
    Ok(client)
}

#[derive(Clone)]
struct Etat {
    bot: Bot,
    secret: Arc<String>,
}

/// Comparaison en temps constant du secret partagé.
fn egal(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

async fn autoriser(State(etat): State<Etat>, req: Request, suite: Next) -> Response {
    let attendu = format!("Bearer {}", etat.secret);
    let fourni = req
        .headers()
        .get(header::AUTHORIZATION)
        .map(|v| v.as_bytes())
        .unwrap_or_default();
    if !egal(fourni, attendu.as_bytes()) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "message": "Secret interne absent ou invalide." })),
        )
            .into_response();
    }
    suite.run(req).await
}

fn repondre<T: Serialize>(resultat: Result<T>) -> Response {
    match resultat {
        Ok(v) => Json(v).into_response(),
        Err(e) => {
            error!("{e:#}");
            (StatusCode::BAD_GATEWAY, Json(json!({ "message": format!("{e:#}") }))).into_response()
        }
    }
}

async fn sante(State(etat): State<Etat>) -> Response {
    let client = &etat.bot.client;
    let identite = client.encryption().cross_signing_status().await;
    Json(json!({
        "statut": "ok",
        "utilisateur": client.user_id(),
        "appareil": client.device_id(),
        "signature_croisee": identite.map(|s| s.is_complete()).unwrap_or(false),
    }))
    .into_response()
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,matrix_sdk=warn,matrix_sdk_crypto=warn".into()),
        )
        .init();
    let r = Reglages::lire()?;
    let client = connecter(&r).await?;
    info!(utilisateur = %r.utilisateur, appareil = ?client.device_id(), "bot de fonction connecté");

    // Synchronisation continue : réception des clés des salons et des changements de membres
    let synchro = client.clone();
    tokio::spawn(async move {
        loop {
            if let Err(e) = synchro.sync(SyncSettings::default()).await {
                warn!("synchronisation interrompue : {e}, reprise dans 5 s");
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    });

    let etat = Etat {
        bot: Bot { client },
        secret: Arc::new(secret(&r.secret_interne_fichier).await?),
    };
    let interne = Router::new()
        .route(
            "/interne/salons",
            post(|State(e): State<Etat>, Json(d)| async move { repondre(operations::creer_salon(&e.bot, d).await) }),
        )
        .route(
            "/interne/passation",
            post(|State(e): State<Etat>, Json(d)| async move { repondre(operations::passation(&e.bot, d).await) }),
        )
        .route(
            "/interne/interim",
            post(|State(e): State<Etat>, Json(d)| async move { repondre(operations::interim(&e.bot, d).await) }),
        )
        .route(
            "/interne/fin-interim",
            post(|State(e): State<Etat>, Json(d)| async move { repondre(operations::fin_interim(&e.bot, d).await) }),
        )
        .route("/interne/sante", get(sante))
        .layer(middleware::from_fn_with_state(etat.clone(), autoriser))
        .with_state(etat);

    let ecouteur = tokio::net::TcpListener::bind(&r.ecoute)
        .await
        .context("ouverture du port interne")?;
    info!("API interne sur {}", r.ecoute);
    axum::serve(ecouteur, interne)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
