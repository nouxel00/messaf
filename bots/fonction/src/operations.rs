//! Les ordres que l'API d'administration donne au bot : créer un salon de fonction,
//! exécuter une passation, ouvrir et clore un intérim. Chaque ordre rend un compte rendu.
use std::collections::HashSet;

use anyhow::Result;
use matrix_sdk::ruma::{OwnedRoomId, OwnedUserId};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tracing::warn;

use crate::matrice::{Bot, Message};

/// Un salon touché par l'ordre, avec l'état `bf.messaf.salon` à y écrire (calculé par l'API).
#[derive(Deserialize)]
pub struct SalonVise {
    pub room_id: OwnedRoomId,
    pub etat: Value,
}

// ----- Création d'un salon de fonction -----

#[derive(Deserialize)]
pub struct DemandeSalon {
    pub nom: String,
    pub sujet: String,
    pub etat: Value,
    pub membres: Vec<OwnedUserId>,
}

#[derive(Serialize)]
pub struct SalonCree {
    pub room_id: OwnedRoomId,
}

pub async fn creer_salon(bot: &Bot, d: DemandeSalon) -> Result<SalonCree> {
    let room_id = bot
        .creer_salon(&d.nom, &d.sujet, Some(&d.etat), &d.membres, true)
        .await?;
    Ok(SalonCree { room_id })
}

// ----- Passation de service -----

#[derive(Deserialize)]
pub struct DemandePassation {
    /// Ex. « Directeur des ressources humaines – Santé (DRH-SANTE) »
    pub libelle: String,
    /// Texte du message système, rédigé par l'API.
    pub annonce: String,
    pub entrant: OwnedUserId,
    pub entrant_nom: String,
    pub sortants: Vec<OwnedUserId>,
    pub sortant_nom: Option<String>,
    /// Date d'effet lisible, ex. « 3 novembre 2026 »
    pub date_effet: String,
    pub salons: Vec<SalonVise>,
    /// Nom neutre du salon qui reçoit le dossier, ex. « FCT-DRH-SANTE · dossier »
    pub dossier_nom: String,
    /// Mutation : salons de l'ancienne fonction de l'entrant, dont il est retiré.
    #[serde(default)]
    pub anciens_salons: Vec<SalonQuitte>,
}

/// Un salon de l'ancienne fonction de l'entrant.
#[derive(Deserialize)]
pub struct SalonQuitte {
    pub room_id: OwnedRoomId,
    pub etat: Value,
    /// Ex. « Issa Sawadogo quitte la fonction … »
    pub annonce: String,
}

#[derive(Serialize)]
pub struct SalonPassation {
    pub room_id: OwnedRoomId,
    pub nom: String,
    pub entrant_invite: bool,
    pub sortants_retires: Vec<OwnedUserId>,
    pub erreur: Option<String>,
}

#[derive(Serialize)]
pub struct ComptePassation {
    pub salons: Vec<SalonPassation>,
    /// Salons de l'ancienne fonction de l'entrant (mutation).
    pub anciens_salons: Vec<SalonPassation>,
    pub dossier: Option<OwnedRoomId>,
    pub erreurs: usize,
}

pub async fn passation(bot: &Bot, d: DemandePassation) -> Result<ComptePassation> {
    let repondants: HashSet<OwnedUserId> = d.sortants.iter().cloned().collect();
    let mut salons = vec![];
    let mut lignes = vec![];

    for vise in &d.salons {
        let mut compte = SalonPassation {
            room_id: vise.room_id.clone(),
            nom: String::new(),
            entrant_invite: false,
            sortants_retires: vec![],
            erreur: None,
        };
        let resultat: Result<()> = async {
            let salon = bot.salon(&vise.room_id)?;
            compte.nom = bot.nom_salon(&salon);
            // Le dossier est préparé avant les changements de membres (noms encore connus)
            let messages = bot.messages(&salon, 100).await?;
            lignes.push(ligne_dossier(bot, &salon, &compte.nom, &messages, &repondants).await);
            // L'entrant d'abord (avec l'historique), puis le retrait du sortant : la fonction n'est jamais vide
            bot.inviter(&salon, &d.entrant, true).await?;
            compte.entrant_invite = true;
            for sortant in &d.sortants {
                // Le sortant reste s'il occupe aussi la fonction d'en face
                if sortant != &d.entrant
                    && !Bot::prevu(&vise.etat, sortant)
                    && bot.retirer(&salon, sortant, "Passation de service").await?
                {
                    compte.sortants_retires.push(sortant.clone());
                }
            }
            bot.ecrire_etat(&salon, &vise.etat).await?;
            bot.avis(&salon, &d.annonce).await?;
            Ok(())
        }
        .await;
        if let Err(e) = resultat {
            warn!(salon = %vise.room_id, "passation : {e:#}");
            compte.erreur = Some(format!("{e:#}"));
        }
        salons.push(compte);
    }

    // Mutation : l'entrant quitte les salons de son ancienne fonction, une fois installé dans la nouvelle
    let nouveaux: HashSet<&OwnedRoomId> = d.salons.iter().map(|s| &s.room_id).collect();
    let mut anciens_salons = vec![];
    for ancien in d.anciens_salons.iter().filter(|s| !nouveaux.contains(&s.room_id)) {
        let mut compte = SalonPassation {
            room_id: ancien.room_id.clone(),
            nom: String::new(),
            entrant_invite: false,
            sortants_retires: vec![],
            erreur: None,
        };
        let resultat: Result<()> = async {
            let salon = bot.salon(&ancien.room_id)?;
            compte.nom = bot.nom_salon(&salon);
            if !Bot::prevu(&ancien.etat, &d.entrant)
                && bot.retirer(&salon, &d.entrant, "Mutation : nouvelle fonction").await?
            {
                compte.sortants_retires.push(d.entrant.clone());
            }
            bot.ecrire_etat(&salon, &ancien.etat).await?;
            bot.avis(&salon, &ancien.annonce).await?;
            Ok(())
        }
        .await;
        if let Err(e) = resultat {
            warn!(salon = %ancien.room_id, "passation, ancienne fonction : {e:#}");
            compte.erreur = Some(format!("{e:#}"));
        }
        anciens_salons.push(compte);
    }

    // Dossier de passation, chiffré pour le seul entrant
    let texte = format!(
        "Dossier de passation — {}\n\
         Remis à {} à compter du {}{}.\n\n\
         Salons de la fonction : {}\n{}\n\n\
         Tout l'historique de ces salons vous a été transmis : vous pouvez le relire dans chaque salon.\n\
         Instructions de service en attente : le suivi des instructions n'est pas encore en service.",
        d.libelle,
        d.entrant_nom,
        d.date_effet,
        d.sortant_nom
            .as_ref()
            .map(|n| format!(", en remplacement de {n}"))
            .unwrap_or_default(),
        d.salons.len(),
        if lignes.is_empty() {
            "• aucun".to_owned()
        } else {
            lignes.join("\n")
        },
    );
    let dossier = envoyer_document(
        bot,
        &d.dossier_nom,
        &format!("Dossier de passation — {}", d.libelle),
        std::slice::from_ref(&d.entrant),
        &texte,
        "passation",
    )
    .await;
    let erreurs = salons
        .iter()
        .chain(&anciens_salons)
        .filter(|s| s.erreur.is_some())
        .count()
        + usize::from(dossier.is_none());
    Ok(ComptePassation {
        salons,
        anciens_salons,
        dossier,
        erreurs,
    })
}

/// Une ligne du dossier : volume d'échanges, dernier échange, messages restés sans réponse.
async fn ligne_dossier(
    bot: &Bot,
    salon: &matrix_sdk::Room,
    nom: &str,
    messages: &[Message],
    repondants: &HashSet<OwnedUserId>,
) -> String {
    let Some(dernier) = messages.last() else {
        return format!("• {nom} — aucun échange.");
    };
    let mut ligne = format!(
        "• {nom} — {} message{} ; dernier échange le {} ({}).",
        messages.len(),
        if messages.len() > 1 { "s" } else { "" },
        Bot::quand(dernier),
        bot.nom(salon, &dernier.auteur).await
    );
    for m in Bot::sans_reponse(messages, repondants) {
        ligne.push_str(&format!(
            "\n    En attente de réponse : « {} » ({}, {})",
            Bot::extrait(&m.texte),
            bot.nom(salon, &m.auteur).await,
            Bot::quand(m)
        ));
    }
    ligne
}

/// Salon privé et chiffré entre le bot et les destinataires, qui reçoit un dossier ou un compte rendu.
async fn envoyer_document(
    bot: &Bot,
    nom: &str,
    sujet: &str,
    destinataires: &[OwnedUserId],
    texte: &str,
    nature: &str,
) -> Option<OwnedRoomId> {
    let etat = json!({ "type": "institutionnel", "document": nature, "archive": true });
    let resultat: Result<OwnedRoomId> = async {
        let room_id = bot.creer_salon(nom, sujet, Some(&etat), destinataires, true).await?;
        let salon = bot.salon(&room_id)?;
        bot.avis(&salon, texte).await?;
        Ok(room_id)
    }
    .await;
    match resultat {
        Ok(id) => Some(id),
        Err(e) => {
            warn!("envoi du document « {nom} » : {e:#}");
            None
        }
    }
}

// ----- Intérim -----

#[derive(Deserialize)]
pub struct DemandeInterim {
    pub libelle: String,
    pub annonce: String,
    pub interimaire: OwnedUserId,
    pub titulaires: Vec<OwnedUserId>,
    pub salons: Vec<SalonVise>,
}

#[derive(Serialize)]
pub struct SalonInterim {
    pub room_id: OwnedRoomId,
    pub nom: String,
    pub interimaire_invite: bool,
    pub affaires_en_cours: usize,
    pub erreur: Option<String>,
}

#[derive(Serialize)]
pub struct CompteInterim {
    pub salons: Vec<SalonInterim>,
    pub erreurs: usize,
}

pub async fn interim(bot: &Bot, d: DemandeInterim) -> Result<CompteInterim> {
    let repondants: HashSet<OwnedUserId> = d.titulaires.iter().cloned().collect();
    let mut salons = vec![];
    for vise in &d.salons {
        let mut compte = SalonInterim {
            room_id: vise.room_id.clone(),
            nom: String::new(),
            interimaire_invite: false,
            affaires_en_cours: 0,
            erreur: None,
        };
        let resultat: Result<()> = async {
            let salon = bot.salon(&vise.room_id)?;
            compte.nom = bot.nom_salon(&salon);
            let messages = bot.messages(&salon, 100).await?;
            // Moindre privilège : pas d'historique, seulement les affaires en cours, republiées
            bot.inviter(&salon, &d.interimaire, false).await?;
            compte.interimaire_invite = true;
            bot.ecrire_etat(&salon, &vise.etat).await?;
            bot.avis(&salon, &d.annonce).await?;
            let affaires = Bot::sans_reponse(&messages, &repondants);
            compte.affaires_en_cours = affaires.len();
            let mut texte = format!("Dossier d'intérim — {}\nAffaires en cours dans ce salon :", d.libelle);
            if affaires.is_empty() {
                texte.push_str("\n• aucune affaire en attente.");
            }
            for m in affaires {
                texte.push_str(&format!(
                    "\n• {}, {} : « {} »",
                    bot.nom(&salon, &m.auteur).await,
                    Bot::quand(m),
                    Bot::extrait(&m.texte)
                ));
            }
            texte.push_str(
                "\nSeules les affaires en cours sont transmises : l'historique complet reste réservé au titulaire.",
            );
            bot.avis(&salon, &texte).await?;
            Ok(())
        }
        .await;
        if let Err(e) = resultat {
            warn!(salon = %vise.room_id, "intérim : {e:#}");
            compte.erreur = Some(format!("{e:#}"));
        }
        salons.push(compte);
    }
    let erreurs = salons.iter().filter(|s| s.erreur.is_some()).count();
    Ok(CompteInterim { salons, erreurs })
}

#[derive(Deserialize)]
pub struct DemandeFinInterim {
    pub libelle: String,
    pub annonce: String,
    pub interimaire: OwnedUserId,
    pub interimaire_nom: String,
    pub titulaires: Vec<OwnedUserId>,
    /// Début de l'intérim, en millisecondes : seuls les messages postérieurs entrent au compte rendu.
    pub depuis_ms: u64,
    /// Ex. « du 3 au 15 novembre 2026 »
    pub periode: String,
    pub salons: Vec<SalonVise>,
    pub compte_rendu_nom: String,
}

#[derive(Serialize)]
pub struct SalonFinInterim {
    pub room_id: OwnedRoomId,
    pub nom: String,
    pub interimaire_retire: bool,
    pub messages_recus: usize,
    pub reponses: usize,
    pub erreur: Option<String>,
}

#[derive(Serialize)]
pub struct CompteFinInterim {
    pub salons: Vec<SalonFinInterim>,
    pub compte_rendu: Option<OwnedRoomId>,
    pub erreurs: usize,
}

pub async fn fin_interim(bot: &Bot, d: DemandeFinInterim) -> Result<CompteFinInterim> {
    let mut salons = vec![];
    let mut lignes = vec![];
    for vise in &d.salons {
        let mut compte = SalonFinInterim {
            room_id: vise.room_id.clone(),
            nom: String::new(),
            interimaire_retire: false,
            messages_recus: 0,
            reponses: 0,
            erreur: None,
        };
        let resultat: Result<()> = async {
            let salon = bot.salon(&vise.room_id)?;
            compte.nom = bot.nom_salon(&salon);
            let messages = bot.messages(&salon, 200).await?;
            let periode: Vec<&Message> = messages.iter().filter(|m| m.ms >= d.depuis_ms).collect();
            let reponses: Vec<&&Message> = periode.iter().filter(|m| m.auteur == d.interimaire).collect();
            compte.reponses = reponses.len();
            compte.messages_recus = periode
                .iter()
                .filter(|m| m.auteur != d.interimaire && !d.titulaires.contains(&m.auteur))
                .count();
            let mut ligne = format!(
                "• {} — {} message{} reçu{}, {} réponse{} de l'intérimaire.",
                compte.nom,
                compte.messages_recus,
                pluriel(compte.messages_recus),
                pluriel(compte.messages_recus),
                compte.reponses,
                pluriel(compte.reponses)
            );
            if let Some(derniere) = reponses.last() {
                ligne.push_str(&format!(
                    "\n    Dernière réponse ({}) : « {} »",
                    Bot::quand(derniere),
                    Bot::extrait(&derniere.texte)
                ));
            }
            lignes.push(ligne);
            // L'intérimaire reste s'il est membre à un autre titre (titulaire de la fonction d'en face)
            if !Bot::prevu(&vise.etat, &d.interimaire) {
                compte.interimaire_retire = bot.retirer(&salon, &d.interimaire, "Fin de l'intérim").await?;
            }
            bot.ecrire_etat(&salon, &vise.etat).await?;
            bot.avis(&salon, &d.annonce).await?;
            Ok(())
        }
        .await;
        if let Err(e) = resultat {
            warn!(salon = %vise.room_id, "fin d'intérim : {e:#}");
            compte.erreur = Some(format!("{e:#}"));
        }
        salons.push(compte);
    }
    let texte = format!(
        "Compte rendu d'intérim — {}\nIntérim assuré par {} {}.\n\n{}\n\nL'intérimaire n'a plus accès aux salons de la fonction.",
        d.libelle,
        d.interimaire_nom,
        d.periode,
        if lignes.is_empty() {
            "• aucun salon".to_owned()
        } else {
            lignes.join("\n")
        },
    );
    let compte_rendu = envoyer_document(
        bot,
        &d.compte_rendu_nom,
        &format!("Compte rendu d'intérim — {}", d.libelle),
        &d.titulaires,
        &texte,
        "compte_rendu_interim",
    )
    .await;
    let erreurs = salons.iter().filter(|s| s.erreur.is_some()).count() + usize::from(compte_rendu.is_none());
    Ok(CompteFinInterim {
        salons,
        compte_rendu,
        erreurs,
    })
}

fn pluriel(n: usize) -> &'static str {
    if n > 1 { "s" } else { "" }
}
