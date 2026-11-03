"""Fiche d'enrôlement PDF, remise en main propre à l'agent.

Le code d'activation qu'elle porte est le mot de passe provisoire du compte :
il n'est enregistré nulle part ailleurs que dans Keycloak (sous forme hachée).
"""
import secrets
from datetime import datetime, timezone

from fpdf import FPDF
from fpdf.enums import XPos, YPos

LIBELLES_HABILITATION = {
    "normal": "Normal",
    "diffusion_restreinte": "Diffusion restreinte",
    "confidentiel": "Confidentiel",
}

# Sans les caractères faciles à confondre (0/O, 1/I/L)
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def nouveau_code() -> str:
    """Code d'activation de 12 caractères, en trois groupes : 4F7K-QM2Z-9WXA."""
    brut = "".join(secrets.choice(ALPHABET) for _ in range(12))
    return f"{brut[0:4]}-{brut[4:8]}-{brut[8:12]}"


def _latin1(texte: str) -> str:
    """Les polices intégrées du PDF ne couvrent que le latin-1."""
    remplacements = {"’": "'", "–": "-", "—": "-", "œ": "oe", "Œ": "OE"}
    for avant, apres in remplacements.items():
        texte = texte.replace(avant, apres)
    return texte.encode("latin-1", "replace").decode("latin-1")


def generer(agent: dict, code: str, adresse_serveur: str, emise_par: str) -> bytes:
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(20, 18, 20)
    pdf.add_page()
    pdf.set_title("MESSAF - Fiche d'enrôlement")

    def ligne(texte: str, taille: float = 10.5, style: str = "", hauteur: float = 6.0) -> None:
        pdf.set_font("Helvetica", style, taille)
        pdf.multi_cell(0, hauteur, _latin1(texte), align="L", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    ligne("MESSAF", 22, "B", 10)
    ligne("Messagerie sécurisée de l'administration du Faso", 11, "", 6)
    pdf.ln(2)
    ligne("FICHE D'ENRÔLEMENT - DOCUMENT CONFIDENTIEL", 12, "B", 7)
    ligne("À remettre en main propre à l'agent. Ne pas photographier, ne pas transmettre par messagerie.", 9.5)
    pdf.ln(4)

    pdf.set_font("Helvetica", "", 10.5)
    for libelle, valeur in [
        ("Nom et prénoms", f"{agent['nom']} {agent['prenoms']}"),
        ("Matricule", agent["matricule"]),
        ("Identifiant MESSAF", agent["matrix_id"]),
        ("Ministère", agent.get("ministere_libelle") or agent.get("ministere") or ""),
        ("Direction", agent.get("direction_libelle") or agent.get("direction") or ""),
        ("Poste", agent.get("poste_intitule") or agent.get("poste") or ""),
        ("Habilitation", LIBELLES_HABILITATION.get(agent.get("habilitation"), agent.get("habilitation") or "")),
    ]:
        pdf.set_font("Helvetica", "B", 10.5)
        pdf.cell(48, 7, _latin1(libelle))
        pdf.set_font("Helvetica", "", 10.5)
        pdf.cell(0, 7, _latin1(str(valeur)), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(5)

    ligne("Code d'activation", 11, "B", 7)
    pdf.set_font("Courier", "B", 24)
    pdf.cell(0, 14, code, border=1, align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    ligne("Valable pour la première connexion uniquement. Tout nouveau téléchargement de cette fiche "
          "annule ce code et en crée un autre.", 9)
    pdf.ln(4)

    ligne("Première connexion", 11, "B", 7)
    for numero, etape in enumerate([
        "Installez l'application MESSAF et une application d'authentification (FreeOTP, Aegis ou Google Authenticator).",
        f"Dans MESSAF, choisissez « Se connecter manuellement », puis « Autre », et saisissez l'adresse {adresse_serveur}.",
        f"Identifiant : {agent['matricule']}. Mot de passe : le code d'activation ci-dessus.",
        "Choisissez votre mot de passe personnel (12 caractères au moins).",
        "Configurez le code à 6 chiffres : ajoutez MESSAF dans l'application d'authentification.",
        "Notez vos codes de secours et gardez-les en lieu sûr : ils remplacent le code à 6 chiffres si votre téléphone est perdu.",
    ], start=1):
        ligne(f"{numero}. {etape}", 10)
    pdf.ln(4)

    maintenant = datetime.now(timezone.utc).strftime("%d/%m/%Y à %H:%M UTC")
    ligne(f"Fiche émise le {maintenant} par {emise_par}.", 9)
    pdf.ln(8)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(85, 6, _latin1("Remise par (nom, signature) :"))
    pdf.cell(0, 6, _latin1("Reçue par l'agent (signature) :"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(18)
    ligne("Prototype MESSAF - données fictives.", 8)
    return bytes(pdf.output())
