//! Opérations Matrix du bot : salons de fonction, invitations, retraits, avis et dossiers.
//!
//! Le bot est membre permanent des salons de fonction : il reçoit donc les clés des messages.
//! Il ne garde rien en dehors de son magasin chiffré, et ne publie que vers les membres du salon.
use std::collections::HashSet;

use anyhow::{Context, Result};
use matrix_sdk::{
    Client, Room,
    room::MessagesOptions,
    ruma::{
        OwnedRoomId, OwnedUserId, RoomId, UInt, UserId,
        api::client::{
            membership::invite_user::{
                self,
                v3::{InvitationRecipient, InviteUserId},
            },
            room::create_room::v3::{Request as CreerSalon, RoomPreset},
        },
        events::{
            AnyInitialStateEvent, InitialStateEvent,
            room::{
                encryption::RoomEncryptionEventContent,
                history_visibility::{HistoryVisibility, RoomHistoryVisibilityEventContent},
                member::MembershipState,
                message::RoomMessageEventContent,
            },
        },
        serde::Raw,
    },
};
use serde_json::{Value, json};

use crate::temps::date_heure;

/// Type de l'état d'un salon MESSAF, visible par le serveur (voir le document de démarrage, « Salons »).
pub const ETAT_SALON: &str = "bf.messaf.salon";

/// Un message texte lu dans un salon.
pub struct Message {
    pub auteur: OwnedUserId,
    pub ms: u64,
    pub texte: String,
}

#[derive(Clone)]
pub struct Bot {
    pub client: Client,
}

impl Bot {
    fn moi(&self) -> &UserId {
        self.client.user_id().expect("session ouverte")
    }

    pub fn salon(&self, id: &RoomId) -> Result<Room> {
        self.client
            .get_room(id)
            .with_context(|| format!("salon {id} inconnu du bot"))
    }

    /// Crée un salon chiffré dont seul le bot gère les membres et l'état.
    /// `historique_partage` : les membres invités ensuite peuvent recevoir l'historique (MSC4268).
    pub async fn creer_salon(
        &self,
        nom: &str,
        sujet: &str,
        etat: Option<&Value>,
        membres: &[OwnedUserId],
        historique_partage: bool,
    ) -> Result<OwnedRoomId> {
        let visibilite = if historique_partage {
            HistoryVisibility::Shared
        } else {
            HistoryVisibility::Joined
        };
        let mut etat_initial = vec![
            InitialStateEvent::with_empty_state_key(RoomEncryptionEventContent::with_recommended_defaults())
                .to_raw_any(),
            InitialStateEvent::with_empty_state_key(RoomHistoryVisibilityEventContent::new(visibilite)).to_raw_any(),
        ];
        if let Some(etat) = etat {
            etat_initial.push(Raw::<AnyInitialStateEvent>::from_json_string(
                json!({ "type": ETAT_SALON, "state_key": "", "content": etat }).to_string(),
            )?);
        }

        // Seul le bot invite, retire et change l'état ; les membres écrivent. Créateur du salon,
        // il a tous les droits (version 12 des salons) : il ne figure donc pas dans « users ».
        let niveaux = json!({
            "users_default": 0,
            "events_default": 0,
            "state_default": 100,
            "invite": 100,
            "kick": 100,
            "ban": 100,
            "redact": 100,
        });

        let mut demande = CreerSalon::new();
        demande.name = Some(nom.to_owned());
        demande.topic = Some(sujet.to_owned());
        demande.preset = Some(RoomPreset::PrivateChat);
        demande.invite = membres.to_vec();
        demande.initial_state = etat_initial;
        demande.power_level_content_override = Some(Raw::from_json_string(niveaux.to_string())?);
        let salon = self.client.create_room(demande).await.context("création du salon")?;
        Ok(salon.room_id().to_owned())
    }

    /// Invite un agent. Avec `historique`, les clés des anciens messages lui sont transmises (MSC4268) ;
    /// sans, il ne lira que les messages postérieurs à son arrivée (intérim : moindre privilège).
    pub async fn inviter(&self, salon: &Room, agent: &UserId, historique: bool) -> Result<()> {
        if let Some(membre) = salon.get_member(agent).await?
            && matches!(membre.membership(), MembershipState::Join | MembershipState::Invite)
        {
            return Ok(());
        }
        if historique {
            salon
                .invite_user_by_id(agent)
                .await
                .context("invitation avec historique")?;
        } else {
            let destinataire = InvitationRecipient::UserId(InviteUserId::new(agent.to_owned()));
            self.client
                .send(invite_user::v3::Request::new(salon.room_id().to_owned(), destinataire))
                .await
                .context("invitation")?;
            salon.mark_members_missing();
        }
        salon.sync_members().await?;
        Ok(())
    }

    /// Retire un agent du salon. Les clés du salon seront renouvelées au prochain message.
    pub async fn retirer(&self, salon: &Room, agent: &UserId, motif: &str) -> Result<bool> {
        match salon.get_member(agent).await? {
            Some(m) if matches!(m.membership(), MembershipState::Join | MembershipState::Invite) => {
                salon.kick_user(agent, Some(motif)).await.context("retrait")?;
                salon.mark_members_missing();
                Ok(true)
            }
            _ => Ok(false),
        }
    }

    pub async fn ecrire_etat(&self, salon: &Room, etat: &Value) -> Result<()> {
        salon
            .send_state_event_raw(ETAT_SALON, "", etat.clone())
            .await
            .context("état du salon")?;
        Ok(())
    }

    /// Message système du bot (avis), chiffré pour les membres du salon.
    pub async fn avis(&self, salon: &Room, texte: &str) -> Result<()> {
        salon.sync_members().await?;
        salon
            .send(RoomMessageEventContent::notice_plain(texte))
            .await
            .context("envoi d'un avis")?;
        Ok(())
    }

    /// Les derniers messages texte du salon, du plus ancien au plus récent, sans ceux du bot.
    pub async fn messages(&self, salon: &Room, limite: u32) -> Result<Vec<Message>> {
        let mut options = MessagesOptions::backward();
        options.limit = UInt::from(limite);
        let reponse = salon.messages(options).await.context("lecture des messages")?;
        let moi = self.moi().to_owned();
        let mut lus = vec![];
        for ev in reponse.chunk.iter().rev() {
            let Ok(v) = ev.raw().deserialize_as::<Value>() else {
                continue;
            };
            if v["type"] != "m.room.message" {
                continue;
            }
            let Some(auteur) = v["sender"].as_str().and_then(|s| OwnedUserId::try_from(s).ok()) else {
                continue;
            };
            if auteur == moi {
                continue;
            }
            let Some(texte) = v["content"]["body"].as_str() else {
                continue;
            };
            lus.push(Message {
                auteur,
                ms: v["origin_server_ts"].as_u64().unwrap_or(0),
                texte: texte.to_owned(),
            });
        }
        Ok(lus)
    }

    /// Nom affiché d'un membre, ou son identifiant.
    pub async fn nom(&self, salon: &Room, agent: &UserId) -> String {
        match salon.get_member(agent).await {
            Ok(Some(m)) => m.display_name().map(str::to_owned).unwrap_or_else(|| agent.to_string()),
            _ => agent.to_string(),
        }
    }

    pub fn nom_salon(&self, salon: &Room) -> String {
        salon.name().unwrap_or_else(|| salon.room_id().to_string())
    }

    /// Les messages restés sans réponse : ceux qui suivent la dernière réponse d'un des `repondants`.
    pub fn sans_reponse<'a>(messages: &'a [Message], repondants: &HashSet<OwnedUserId>) -> &'a [Message] {
        let debut = messages
            .iter()
            .rposition(|m| repondants.contains(&m.auteur))
            .map_or(0, |i| i + 1);
        &messages[debut..]
    }

    /// Vrai si l'état du salon garde l'agent comme membre : titulaire ou intérimaire de l'une des deux
    /// fonctions du salon. Ex. le sortant d'une fonction peut être le titulaire de la fonction d'en face.
    pub fn prevu(etat: &Value, agent: &UserId) -> bool {
        let id = agent.as_str();
        etat["fonctions"].as_array().into_iter().flatten().any(|f| {
            f["titulaires"]
                .as_array()
                .into_iter()
                .flatten()
                .any(|t| t.as_str() == Some(id))
                || f["interimaires"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .any(|i| i["matrix_id"].as_str() == Some(id))
        })
    }

    pub fn extrait(texte: &str) -> String {
        let propre: String = texte.split_whitespace().collect::<Vec<_>>().join(" ");
        if propre.chars().count() > 160 {
            format!("{}…", propre.chars().take(160).collect::<String>())
        } else {
            propre
        }
    }

    pub fn quand(m: &Message) -> String {
        date_heure(m.ms)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use matrix_sdk::ruma::user_id;

    #[test]
    fn membre_prevu_par_l_etat() {
        let etat = json!({ "fonctions": [
            { "poste": "DRH-SANTE", "titulaires": ["@m100005:gov.bf"], "interimaires": [] },
            { "poste": "DH-SANTE", "titulaires": ["@m100006:gov.bf"],
              "interimaires": [{ "matrix_id": "@m100008:gov.bf", "jusqu_au": "2026-11-06" }] },
        ]});
        assert!(Bot::prevu(&etat, user_id!("@m100006:gov.bf")));
        assert!(Bot::prevu(&etat, user_id!("@m100008:gov.bf")));
        assert!(!Bot::prevu(&etat, user_id!("@m100007:gov.bf")));
        assert!(!Bot::prevu(&json!({}), user_id!("@m100005:gov.bf")));
    }
}
