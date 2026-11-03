"""Jeu de données fictif (section 10 du document de démarrage).

Organigramme et postes repris du mode démonstration du portail (Lionnel), pour
que le portail affiche la même chose qu'il soit branché sur l'API ou non.
Chargé au démarrage quand MESSAF_DEMO=1, sans écraser ce qui existe déjà.
Ces personnes et ces structures n'existent pas.
"""
import logging

from . import base
from .keycloak import keycloak

journal = logging.getLogger("messaf.demo")

STRUCTURES = [
    # Ministère de la Santé (fictif)
    ("sante", "Ministère de la Santé", "MS", "ministere", None),
    ("sante-sg", "Secrétariat général", "SG", "direction", "sante"),
    ("sante-sg-cab", "Service du courrier et de la coordination", None, "service", "sante-sg"),
    ("sante-drh", "Direction des ressources humaines", "DRH", "direction", "sante"),
    ("sante-drh-sgc", "Service de la gestion des carrières", None, "service", "sante-drh"),
    ("sante-drh-sfp", "Service de la formation du personnel", None, "service", "sante-drh"),
    ("sante-dsi", "Direction des systèmes d'information", "DSI", "direction", "sante"),
    ("sante-dsi-sinf", "Service des infrastructures", None, "service", "sante-dsi"),
    ("sante-dh", "Direction des hôpitaux", "DH", "direction", "sante"),
    ("sante-dh-sah", "Service de l'administration hospitalière", None, "service", "sante-dh"),
    ("sante-dh-sqs", "Service de la qualité des soins", None, "service", "sante-dh"),
    ("sante-ig", "Inspection générale", "IG", "direction", "sante"),
    ("sante-ig-sc", "Service du contrôle", None, "service", "sante-ig"),
    ("sante-arch", "Direction des archives", None, "direction", "sante"),
    ("sante-arch-sc", "Service de la conservation", None, "service", "sante-arch"),
    # Ministère des Finances (fictif)
    ("finances", "Ministère des Finances", "MF", "ministere", None),
    ("finances-dsi", "Direction des systèmes d'information", "DSI", "direction", "finances"),
    ("finances-dsi-sinf", "Service des infrastructures", None, "service", "finances-dsi"),
    # Ministère chargé du numérique (fictif)
    ("numerique", "Ministère de la Transition digitale", "MTD", "ministere", None),
    ("numerique-dgtd", "Direction générale de la transformation digitale", "DGTD", "direction", "numerique"),
    ("numerique-dgtd-splat", "Service des plateformes", None, "service", "numerique-dgtd"),
]

POSTES = [
    ("SG-SANTE", "Secrétaire général", "sante-sg", None, "confidentiel"),
    ("AGT-SG-SANTE", "Chargé du courrier", "sante-sg-cab", "SG-SANTE", "diffusion_restreinte"),
    ("DRH-SANTE", "Directeur des ressources humaines", "sante-drh", "SG-SANTE", "confidentiel"),
    ("ADJ-DRH-SANTE", "Directeur adjoint des ressources humaines", "sante-drh", "DRH-SANTE", "confidentiel"),
    ("RH-SANTE", "Gestionnaire des ressources humaines", "sante-drh-sgc", "DRH-SANTE", "normal"),
    ("CS-SGC-SANTE", "Chef du service de la gestion des carrières", "sante-drh-sgc", "DRH-SANTE", "diffusion_restreinte"),
    ("AGT-SFP-SANTE", "Chargé de la formation", "sante-drh-sfp", "DRH-SANTE", "normal"),
    ("DSI-SANTE", "Directeur des systèmes d'information", "sante-dsi", "SG-SANTE", "normal"),
    ("AGT-DSI-SANTE", "Technicien informatique", "sante-dsi-sinf", "DSI-SANTE", "normal"),
    ("DH-SANTE", "Directeur des hôpitaux", "sante-dh", "SG-SANTE", "diffusion_restreinte"),
    ("AGT-DH-SANTE", "Chargé d'études, Direction des hôpitaux", "sante-dh-sah", "DH-SANTE", "normal"),
    ("CS-SQS-SANTE", "Chef du service de la qualité des soins", "sante-dh-sqs", "DH-SANTE", "diffusion_restreinte"),
    ("IG-SANTE", "Inspecteur", "sante-ig-sc", None, "normal"),
    ("ARCH-SANTE", "Archiviste", "sante-arch-sc", None, "normal"),
    ("DSI-FINANCES", "Directeur des systèmes d'information", "finances-dsi", None, "normal"),
    ("AGT-DSI-FINANCES", "Technicien informatique", "finances-dsi-sinf", "DSI-FINANCES", "normal"),
    ("DGTD", "Directeur général de la transformation digitale", "numerique-dgtd", None, "normal"),
]

# matricule, ministère, direction, service, poste, date de début, e-mail, téléphone
AGENTS = [
    ("100001", "numerique", "numerique-dgtd", "numerique-dgtd-splat", "DGTD", "2026-01-05", "admin.national@numerique.messaf.example", None),
    ("100002", "sante", "sante-dsi", "sante-dsi-sinf", "DSI-SANTE", "2025-03-01", "paul.zongo@sante.messaf.example", "+226 70 00 00 02"),
    ("100003", "sante", "sante-drh", "sante-drh-sgc", "RH-SANTE", "2024-09-02", "mariam.traore@sante.messaf.example", "+226 70 00 00 03"),
    ("100004", "sante", "sante-sg", "sante-sg-cab", "SG-SANTE", "2023-06-12", "jean.compaore@sante.messaf.example", None),
    ("100005", "sante", "sante-drh", "sante-drh-sgc", "DRH-SANTE", "2024-01-15", "awa.ouedraogo@sante.messaf.example", "+226 70 00 00 05"),
    ("100006", "sante", "sante-drh", "sante-drh-sgc", "ADJ-DRH-SANTE", "2024-04-01", "issa.sawadogo@sante.messaf.example", None),
    ("100007", "sante", "sante-dh", "sante-dh-sah", "DH-SANTE", "2022-11-07", "moussa.kabore@sante.messaf.example", None),
    ("100008", "sante", "sante-dh", "sante-dh-sah", "AGT-DH-SANTE", "2025-02-03", "fatimata.diallo@sante.messaf.example", "+226 70 00 00 08"),
    ("100009", "sante", "sante-ig", "sante-ig-sc", "IG-SANTE", "2023-01-09", "salif.ouattara@sante.messaf.example", None),
    ("100010", "sante", "sante-arch", "sante-arch-sc", "ARCH-SANTE", "2024-07-01", "aminata.sanogo@sante.messaf.example", None),
    ("100011", "finances", "finances-dsi", "finances-dsi-sinf", "DSI-FINANCES", "2025-05-05", "boukary.nikema@finances.messaf.example", None),
]


def charger() -> None:
    with base.connexion() as cnx:
        for code, libelle, sigle, type_, parent in STRUCTURES:
            cnx.execute(
                "INSERT INTO structures (code, libelle, sigle, type, parent) VALUES (%s, %s, %s, %s, %s) "
                "ON CONFLICT (code) DO NOTHING",
                (code, libelle, sigle, type_, parent),
            )
        for code, intitule, structure, superieur, habilitation in POSTES:
            cnx.execute(
                "INSERT INTO postes (code, intitule, structure, poste_superieur, habilitation_requise) "
                "VALUES (%s, %s, %s, %s, %s) ON CONFLICT (code) DO NOTHING",
                (code, intitule, structure, superieur, habilitation),
            )
        for matricule, _m, _d, _s, poste, debut, _e, telephone in AGENTS:
            cnx.execute(
                "INSERT INTO profils (matricule, telephone) VALUES (%s, %s) ON CONFLICT (matricule) DO NOTHING",
                (matricule, telephone),
            )
            if not cnx.execute("SELECT 1 FROM affectations WHERE matricule = %s", (matricule,)).fetchone():
                cnx.execute(
                    "INSERT INTO affectations (matricule, poste, date_debut) VALUES (%s, %s, %s)",
                    (matricule, poste, debut),
                )
    aligner_keycloak()


def aligner_keycloak() -> None:
    """Met les comptes fictifs de Keycloak aux codes d'organigramme.

    Le premier import du domaine (jalon 1) utilisait des libellés (« Santé », « DRH ») :
    ils sont remplacés une seule fois par les codes du portail (« sante », « sante-drh »).
    """
    codes = {s[0] for s in STRUCTURES}
    for matricule, ministere, direction, service, _p, _d, email, _t in AGENTS:
        try:
            utilisateur = keycloak.utilisateur(matricule)
        except Exception as erreur:  # Keycloak pas encore prêt : on réessaiera au prochain démarrage
            journal.warning("Keycloak injoignable, alignement du jeu de démonstration reporté : %s", erreur)
            return
        if not utilisateur:
            continue
        attributs = utilisateur.get("attributes", {})
        if attributs.get("ministere", [None])[0] in codes:
            continue
        attributs.update({"ministere": [ministere], "direction": [direction], "service": [service]})
        utilisateur["attributes"] = attributs
        utilisateur.setdefault("email", email)
        keycloak.modifier(utilisateur["id"], utilisateur)
        journal.info("Compte fictif %s aligné sur les codes d'organigramme", matricule)
