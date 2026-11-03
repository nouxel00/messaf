"""Outils communs aux routes de l'API : lecture des attributs Keycloak, contrôles d'accès journalisés."""
from .base import journaliser
from .config import reglages
from .erreurs import ErreurApi, introuvable, invalide
from .keycloak import keycloak
from .securite import Utilisateur, exiger_perimetre, exiger_role


def valeur(utilisateur: dict, attribut: str) -> str | None:
    valeurs = utilisateur.get("attributes", {}).get(attribut) or [None]
    return valeurs[0]


def matrix_id(matricule: str) -> str:
    return f"@m{matricule}:{reglages.serveur_matrix}"


def agent_keycloak(matricule: str) -> dict:
    utilisateur = keycloak.utilisateur(matricule)
    if not utilisateur or not valeur(utilisateur, "matricule"):
        raise introuvable("Aucun agent ne porte ce matricule.")
    return utilisateur


def nom_agent(utilisateur: dict) -> str:
    return f"{utilisateur.get('firstName', '')} {utilisateur.get('lastName', '')}".strip() or utilisateur["username"]


def controler(utilisateur: Utilisateur, action: str, roles: tuple, ministere: str | None, cible: str | None) -> None:
    """Contrôle d'accès d'une action sensible ; tout refus est inscrit au journal d'audit."""
    try:
        exiger_role(utilisateur, *roles)
        exiger_perimetre(utilisateur, ministere)
    except ErreurApi as erreur:
        journaliser(utilisateur.identifiant, action, "refus", cible, ministere, {"motif": erreur.message})
        raise


def ministere_demande(utilisateur: Utilisateur, ministere: str | None) -> str:
    ministere = ministere or utilisateur.ministere
    if not ministere:
        raise invalide({"ministere": "Précisez le ministère."})
    exiger_perimetre(utilisateur, ministere)
    return ministere
