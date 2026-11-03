"""Adressage par fonction : salons de fonction, passations de service, absences et intérims (jalon 2).

Cahier des charges, chapitres 06 et 07. L'API décide (qui, quand, quels salons) et tient le registre ;
le bot de fonction exécute dans Matrix et rend compte salon par salon. Chaque étape est journalisée.
"""
import logging
import threading
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import Field, model_validator

from . import base
from .bot import bot
from .config import reglages
from .erreurs import ErreurApi, conflit, interdit, introuvable, invalide
from .keycloak import keycloak
from .modeles import Erreur, Strict
from .outils import agent_keycloak, controler, matrix_id, ministere_demande, nom_agent, valeur
from .securite import Utilisateur, exiger_perimetre, exiger_role, utilisateur_courant

routeur = APIRouter()
journal = logging.getLogger("messaf.fonctions")

ADMINISTRATEURS = ("admin_ministere",)
RH = ("gestionnaire_rh",)
LECTEURS = ("gestionnaire_rh", "admin_ministere", "superieur", "auditeur")
RANG = {"normal": 0, "diffusion_restreinte": 1, "confidentiel": 2}
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre",
        "novembre", "décembre"]
PROFONDEUR_MAX = 3  # remontée vers le supérieur quand l'intérimaire est lui-même absent
MATRICULE = r"^[0-9]{6}$"


def _erreurs(*statuts: int) -> dict:
    return {s: {"model": Erreur} for s in statuts}


def date_longue(d: date) -> str:
    return f"{d.day}{'er' if d.day == 1 else ''} {MOIS[d.month - 1]} {d.year}"


def aujourdhui() -> date:
    # Fuseau de Ouagadougou : UTC
    return datetime.now(timezone.utc).date()


# ----- Registre : postes, titulaires, intérimaires, salons -----

def poste_ou_404(code: str) -> dict:
    p = base.poste(code)
    if not p:
        raise introuvable("Aucun poste ne porte ce code.")
    return p


def ministere_du_poste(p: dict) -> str | None:
    with base.connexion() as cnx:
        ligne = cnx.execute(
            """
            WITH RECURSIVE remontee AS (
                SELECT code, type, parent FROM structures WHERE code = %s
                UNION ALL
                SELECT s.code, s.type, s.parent FROM structures s JOIN remontee r ON s.code = r.parent
            )
            SELECT code FROM remontee WHERE type = 'ministere' LIMIT 1
            """,
            (p["structure"],),
        ).fetchone()
    return ligne["code"] if ligne else None


def libelle(p: dict) -> str:
    return f"{p['intitule']} ({p['code']})"


def interimaires_en_cours(code: str) -> list[dict]:
    with base.connexion() as cnx:
        return cnx.execute(
            "SELECT interimaire, date_fin FROM absences WHERE poste = %s AND etat = 'en_cours' AND interimaire IS NOT NULL",
            (code,),
        ).fetchall()


def salons_de(code: str) -> list[dict]:
    with base.connexion() as cnx:
        return cnx.execute(
            "SELECT * FROM salons_fonction WHERE poste = %s OR interlocuteur = %s ORDER BY cree_le",
            (code, code),
        ).fetchall()


class Annuaire:
    """Noms et fiches Keycloak, lus une seule fois par requête."""

    def __init__(self) -> None:
        self._fiches: dict[str, dict | None] = {}

    def fiche(self, matricule: str) -> dict | None:
        if matricule not in self._fiches:
            self._fiches[matricule] = keycloak.utilisateur(matricule)
        return self._fiches[matricule]

    def nom(self, matricule: str | None) -> str | None:
        if not matricule:
            return None
        fiche = self.fiche(matricule)
        return nom_agent(fiche) if fiche else matricule

    def personne(self, matricule: str | None) -> dict | None:
        if not matricule:
            return None
        return {"matricule": matricule, "nom": self.nom(matricule), "matrix_id": matrix_id(matricule)}


def etat_salon(salon: dict, titulaires: dict[str, list[str]] | None = None,
               interims: dict[str, list[tuple[str, date]]] | None = None) -> dict:
    """Contenu de l'état bf.messaf.salon : les fonctions du salon, leurs titulaires et intérimaires.

    `titulaires` et `interims` remplacent l'état de la base pour un poste (opération en cours).
    L'application s'en sert pour afficher « en qualité de ».
    """
    fonctions = []
    for code in (salon["poste"], salon["interlocuteur"]):
        p = base.poste(code)
        tit = (titulaires or {}).get(code)
        if tit is None:
            tit = base.titulaires(code)
        inter = (interims or {}).get(code)
        if inter is None:
            inter = [(l["interimaire"], l["date_fin"]) for l in interimaires_en_cours(code)]
        fonctions.append({
            "poste": code,
            "libelle": p["intitule"] if p else code,
            "titulaires": [matrix_id(m) for m in sorted(tit)],
            "interimaires": [{"matrix_id": matrix_id(m), "jusqu_au": fin.isoformat()} for m, fin in sorted(inter)],
        })
    return {"type": "fonction", "poste": salon["poste"], "interlocuteur": salon["interlocuteur"],
            "classification": salon.get("classification") or "normal", "archive": True, "fonctions": fonctions}


def niveau_maximal(p: dict, autre: dict) -> str:
    """Le niveau le plus haut possible pour le salon de deux fonctions : chaque titulaire doit y être habilité."""
    return min(p["habilitation_requise"], autre["habilitation_requise"], key=RANG.__getitem__)


def habilite_pour(matricule: str, classification: str, annuaire: "Annuaire") -> bool:
    """Vrai si l'agent peut entrer dans un salon de ce niveau (habilitation au moins égale)."""
    fiche = annuaire.fiche(matricule)
    return bool(fiche) and RANG.get(valeur(fiche, "habilitation") or "normal", 0) >= RANG[classification]


def memoriser_etats(salons: list[dict]) -> None:
    """Retient l'état écrit par le bot dans chaque salon, pour ne le réécrire que s'il change."""
    with base.connexion() as cnx:
        for s in salons:
            cnx.execute("UPDATE salons_fonction SET etat_ecrit = %s WHERE room_id = %s", (base.Json(s["etat"]), s["room_id"]))


def creer_salon_fonction(poste_code: str, interlocuteur: str, auteur: str, classification: str = "normal") -> dict:
    p, autre = poste_ou_404(poste_code), poste_ou_404(interlocuteur)
    if poste_code == interlocuteur:
        raise invalide({"interlocuteur": "Choisissez une autre fonction."})
    if RANG[classification] > RANG[niveau_maximal(p, autre)]:
        raise invalide({"classification": "Niveau trop élevé : les titulaires de ces fonctions n'y sont pas tous habilités."})
    with base.connexion() as cnx:
        existant = cnx.execute(
            "SELECT * FROM salons_fonction WHERE (poste = %s AND interlocuteur = %s) OR (poste = %s AND interlocuteur = %s)",
            (poste_code, interlocuteur, interlocuteur, poste_code),
        ).fetchone()
    if existant:
        raise conflit("salon_existant", "Ces deux fonctions ont déjà leur salon.")
    salon = {"poste": poste_code, "interlocuteur": interlocuteur, "classification": classification}
    annuaire = Annuaire()
    agents = []
    for code in (poste_code, interlocuteur):
        agents += base.titulaires(code)
        agents += [l["interimaire"] for l in interimaires_en_cours(code)]
    # Un agent dont l'habilitation ne suffit pas n'est pas invité (salon classé)
    membres = sorted({matrix_id(m) for m in agents if habilite_pour(m, classification, annuaire)})
    nom = f"FCT-{poste_code} · {interlocuteur}"
    etat = etat_salon(salon)
    room_id = bot.creer_salon(nom, f"{p['intitule']} ↔ {autre['intitule']}", etat, membres)
    with base.connexion() as cnx:
        ligne = cnx.execute(
            "INSERT INTO salons_fonction (room_id, poste, interlocuteur, nom, cree_par, classification, etat_ecrit) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *",
            (room_id, poste_code, interlocuteur, nom, auteur, classification, base.Json(etat)),
        ).fetchone()
    base.journaliser(auteur, "salon_fonction", "succes", poste_code, ministere_du_poste(p),
                     {"interlocuteur": interlocuteur, "room_id": room_id, "classification": classification})
    return ligne


def vue_salon(s: dict) -> dict:
    return {"room_id": s["room_id"], "nom": s["nom"], "poste": s["poste"], "interlocuteur": s["interlocuteur"],
            "classification": s["classification"], "cree_le": s["cree_le"].isoformat()}


def vue_fonction(p: dict, annuaire: Annuaire) -> dict:
    titulaires = base.titulaires(p["code"])
    return {
        "poste": p,
        "titulaires": [annuaire.personne(m) for m in titulaires],
        "interimaires": [dict(annuaire.personne(l["interimaire"]), jusqu_au=l["date_fin"].isoformat())
                         for l in interimaires_en_cours(p["code"])],
        "vacante": not titulaires,
        "salons": [vue_salon(s) for s in salons_de(p["code"])],
    }


# ----- Routes : fonctions et salons -----

@routeur.get("/fonctions", tags=["Fonctions"], summary="Les fonctions du ministère : titulaires, intérimaires, salons",
             responses=_erreurs(401, 403, 422))
def lister_fonctions(ministere: str | None = Query(default=None), utilisateur: Utilisateur = Depends(utilisateur_courant)):
    exiger_role(utilisateur, *LECTEURS)
    ministere = ministere_demande(utilisateur, ministere)
    annuaire = Annuaire()
    return [vue_fonction(p, annuaire) for p in base.postes_du_ministere(ministere)]


@routeur.get("/fonctions/{poste}", tags=["Fonctions"], summary="Une fonction et l'historique de ses titulaires",
             responses=_erreurs(401, 403, 404))
def obtenir_fonction(poste: str, utilisateur: Utilisateur = Depends(utilisateur_courant)):
    exiger_role(utilisateur, *LECTEURS)
    p = poste_ou_404(poste)
    exiger_perimetre(utilisateur, ministere_du_poste(p))
    annuaire = Annuaire()
    vue = vue_fonction(p, annuaire)
    vue["historique"] = [
        {"titulaire": annuaire.personne(a["matricule"]), "date_debut": a["date_debut"].isoformat(),
         "date_fin": a["date_fin"].isoformat() if a["date_fin"] else None}
        for a in base.historique_titulaires(poste)
    ]
    return vue


class NouveauSalon(Strict):
    interlocuteur: str = Field(min_length=1, max_length=64, description="Code de l'autre fonction, ex. DH-SANTE")
    classification: Literal["normal", "diffusion_restreinte", "confidentiel"] = Field(
        default="normal", description="Au plus l'habilitation requise par chacune des deux fonctions")


@routeur.post("/fonctions/{poste}/salons", status_code=201, tags=["Fonctions"],
              summary="Ouvrir le salon entre deux fonctions (le bot le crée et y invite les titulaires)",
              responses=_erreurs(401, 403, 404, 409, 422, 503))
def ouvrir_salon(poste: str, corps: NouveauSalon, utilisateur: Utilisateur = Depends(utilisateur_courant)):
    p = poste_ou_404(poste)
    controler(utilisateur, "salon_fonction", ADMINISTRATEURS, ministere_du_poste(p), poste)
    return vue_salon(creer_salon_fonction(poste, corps.interlocuteur, utilisateur.identifiant, corps.classification))


# ----- Passations -----

class NouvellePassation(Strict):
    poste: str = Field(min_length=1, max_length=64)
    entrant: str = Field(pattern=MATRICULE)
    sortant: str | None = Field(default=None, pattern=MATRICULE,
                                description="Obligatoire si le poste a plusieurs titulaires (secrétariat)")
    date_effet: date
    motif: str | None = Field(default=None, max_length=500)


def _agent_actif(matricule: str, champ: str) -> dict:
    fiche = keycloak.utilisateur(matricule)
    if not fiche or not valeur(fiche, "matricule"):
        raise invalide({champ: "Aucun agent ne porte ce matricule."})
    if not fiche.get("enabled") or valeur(fiche, "etat") == "revoque":
        raise invalide({champ: "Ce compte n'est pas actif."})
    return fiche


def _habilite(fiche: dict, p: dict) -> bool:
    return RANG.get(valeur(fiche, "habilitation") or "normal", 0) >= RANG[p["habilitation_requise"]]


def vue_passation(l: dict, annuaire: Annuaire) -> dict:
    p = base.poste(l["poste"])
    return {
        "id": l["id"], "poste": l["poste"], "intitule": p["intitule"] if p else l["poste"],
        "sortant": annuaire.personne(l["sortant"]), "entrant": annuaire.personne(l["entrant"]),
        "date_effet": l["date_effet"].isoformat(), "motif": l["motif"], "statut": l["statut"],
        "demandee_par": annuaire.personne(l["demandee_par"]) if l["demandee_par"].isdigit() else None,
        "demandee_le": l["demandee_le"].isoformat(),
        "executee_le": l["executee_le"].isoformat() if l["executee_le"] else None,
        "compte_rendu": l["compte_rendu"],
    }


def _passation(id_: int) -> dict:
    with base.connexion() as cnx:
        ligne = cnx.execute("SELECT * FROM passations WHERE id = %s", (id_,)).fetchone()
    if not ligne:
        raise introuvable("Aucune passation ne porte ce numéro.")
    return ligne


_verrou = threading.Lock()


def executer_passation(id_: int, auteur: str) -> dict:
    """Le bot change les membres des salons ; si tout a réussi, l'affectation change dans la base."""
    with _verrou:
        l = _passation(id_)
        if l["statut"] not in ("planifiee", "echec"):
            raise conflit("passation_terminee", "Cette passation n'est plus à exécuter.")
        if l["date_effet"] > aujourdhui():
            raise conflit("passation_future", f"Cette passation prendra effet le {date_longue(l['date_effet'])}.")
        p = base.poste(l["poste"])
        ministere = ministere_du_poste(p)
        annuaire = Annuaire()
        sortants = [l["sortant"]] if l["sortant"] else []
        nouveaux = [m for m in base.titulaires(l["poste"]) if m not in sortants and m != l["entrant"]] + [l["entrant"]]
        salons = salons_de(l["poste"])
        entrant_nom, sortant_nom = annuaire.nom(l["entrant"]), annuaire.nom(l["sortant"])
        # Mutation : l'entrant quitte son poste actuel, et les salons de cette ancienne fonction
        anciens = [c for c in base.postes_occupes(l["entrant"]) if c != l["poste"]]
        apres = {l["poste"]: nouveaux, **{c: [m for m in base.titulaires(c) if m != l["entrant"]] for c in anciens}}
        ids = {s["room_id"] for s in salons}
        anciens_salons = []
        for code in anciens:
            ap = base.poste(code)
            anciens_salons += [{
                "room_id": s["room_id"], "etat": etat_salon(s, titulaires=apres),
                "annonce": f"{entrant_nom} quitte la fonction {libelle(ap)} pour prendre celle de {libelle(p)}.",
            } for s in salons_de(code) if s["room_id"] not in ids]
        quand = date_longue(l["date_effet"])
        annonce = (f"Passation de service : {entrant_nom} remplace {sortant_nom} comme {libelle(p)} à compter du {quand}."
                   if sortant_nom else f"Prise de fonction : {entrant_nom} devient {libelle(p)} à compter du {quand}.")
        ordre = {
            "libelle": libelle(p), "annonce": annonce,
            "entrant": matrix_id(l["entrant"]), "entrant_nom": entrant_nom,
            "sortants": [matrix_id(m) for m in sortants], "sortant_nom": sortant_nom,
            "date_effet": quand,
            "salons": [{"room_id": s["room_id"], "etat": etat_salon(s, titulaires=apres)} for s in salons],
            "dossier_nom": f"FCT-{l['poste']} · dossier de passation",
            "anciens_salons": anciens_salons,
        }
        try:
            compte = bot.passation(ordre)
        except ErreurApi as erreur:
            compte = {"erreur": erreur.message, "erreurs": 1, "salons": []}
        reussie = compte.get("erreurs", 1) == 0
        if reussie:
            memoriser_etats(ordre["salons"] + ordre["anciens_salons"])
        with base.connexion() as cnx:
            if reussie:
                if l["sortant"]:
                    base.cloturer_affectations(cnx, l["sortant"], [l["poste"]], l["date_effet"])
                if anciens:
                    base.cloturer_affectations(cnx, l["entrant"], anciens, l["date_effet"])
                cnx.execute("INSERT INTO affectations (matricule, poste, date_debut) VALUES (%s, %s, %s)",
                            (l["entrant"], l["poste"], l["date_effet"]))
            cnx.execute(
                "UPDATE passations SET statut = %s, executee_le = CASE WHEN %s THEN now() ELSE executee_le END, "
                "compte_rendu = %s WHERE id = %s",
                ("executee" if reussie else "echec", reussie, base.Json(compte), id_),
            )
        base.journaliser(auteur, "passation", "succes" if reussie else "echec", l["entrant"], ministere, {
            "poste": l["poste"], "sortant": l["sortant"], "salons": len(salons), "ancien_poste": anciens or None,
            **({} if reussie else {"erreur": compte.get("erreur") or f"{compte.get('erreurs')} salon(s) en échec"}),
        })
        return vue_passation(_passation(id_), annuaire)


@routeur.post("/passations", status_code=201, tags=["Passations"],
              summary="Planifier une passation de service (exécutée tout de suite si la date d'effet est atteinte)",
              responses=_erreurs(401, 403, 404, 409, 422, 503))
def planifier_passation(corps: NouvellePassation, utilisateur: Utilisateur = Depends(utilisateur_courant)):
    p = poste_ou_404(corps.poste)
    ministere = ministere_du_poste(p)
    controler(utilisateur, "passation", ADMINISTRATEURS, ministere, corps.poste)
    fiche = _agent_actif(corps.entrant, "entrant")
    if valeur(fiche, "ministere") != ministere:
        raise invalide({"entrant": "Cet agent n'appartient pas au ministère du poste."})
    if not _habilite(fiche, p):
        raise invalide({"entrant": f"Habilitation insuffisante : le poste exige « {p['habilitation_requise']} »."})
    if corps.date_effet < aujourdhui():
        raise invalide({"date_effet": "La date d'effet ne peut pas être passée."})
    titulaires = base.titulaires(corps.poste)
    if corps.entrant in titulaires:
        raise conflit("deja_titulaire", "Cet agent occupe déjà ce poste.")
    sortant = corps.sortant
    if sortant is None and len(titulaires) > 1:
        raise invalide({"sortant": "Ce poste a plusieurs titulaires : précisez le sortant."})
    if sortant is None and titulaires:
        sortant = titulaires[0]
    if sortant is not None and sortant not in titulaires:
        raise invalide({"sortant": "Cet agent n'occupe pas ce poste."})
    with base.connexion() as cnx:
        if cnx.execute("SELECT 1 FROM passations WHERE poste = %s AND statut IN ('planifiee', 'echec')",
                       (corps.poste,)).fetchone():
            raise conflit("passation_en_attente", "Une passation est déjà prévue pour ce poste.")
        id_ = cnx.execute(
            "INSERT INTO passations (poste, sortant, entrant, date_effet, motif, demandee_par) "
            "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (corps.poste, sortant, corps.entrant, corps.date_effet, corps.motif, utilisateur.identifiant),
        ).fetchone()["id"]
    base.journaliser(utilisateur.identifiant, "passation_planifiee", "succes", corps.entrant, ministere, {
        "poste": corps.poste, "sortant": sortant, "date_effet": corps.date_effet.isoformat(), "motif": corps.motif,
    })
    if corps.date_effet <= aujourdhui():
        return executer_passation(id_, utilisateur.identifiant)
    return vue_passation(_passation(id_), Annuaire())


@routeur.get("/passations", tags=["Passations"], summary="Les passations du ministère, de la plus récente à la plus ancienne",
             responses=_erreurs(401, 403, 422))
def lister_passations(ministere: str | None = Query(default=None), utilisateur: Utilisateur = Depends(utilisateur_courant)):
    exiger_role(utilisateur, *ADMINISTRATEURS, "auditeur")
    codes = [p["code"] for p in base.postes_du_ministere(ministere_demande(utilisateur, ministere))]
    with base.connexion() as cnx:
        lignes = cnx.execute("SELECT * FROM passations WHERE poste = ANY(%s) ORDER BY id DESC", (codes,)).fetchall()
    annuaire = Annuaire()
    return [vue_passation(l, annuaire) for l in lignes]


def _controler_passation(id_: int, utilisateur: Utilisateur, action: str) -> dict:
    l = _passation(id_)
    controler(utilisateur, action, ADMINISTRATEURS, ministere_du_poste(base.poste(l["poste"])), l["entrant"])
    return l


@routeur.post("/passations/{id_}/execution", tags=["Passations"],
              summary="Relancer une passation en échec, ou exécuter une passation dont la date est atteinte",
              responses=_erreurs(401, 403, 404, 409, 503))
def relancer_passation(id_: int, utilisateur: Utilisateur = Depends(utilisateur_courant)):
    _controler_passation(id_, utilisateur, "passation")
    return executer_passation(id_, utilisateur.identifiant)


@routeur.post("/passations/{id_}/annulation", tags=["Passations"], summary="Annuler une passation planifiée",
              responses=_erreurs(401, 403, 404, 409))
def annuler_passation(id_: int, utilisateur: Utilisateur = Depends(utilisateur_courant)):
    l = _controler_passation(id_, utilisateur, "passation_annulee")
    if l["statut"] not in ("planifiee", "echec"):
        raise conflit("passation_terminee", "Cette passation ne peut plus être annulée.")
    with base.connexion() as cnx:
        cnx.execute("UPDATE passations SET statut = 'annulee' WHERE id = %s", (id_,))
    base.journaliser(utilisateur.identifiant, "passation_annulee", "succes", l["entrant"],
                     ministere_du_poste(base.poste(l["poste"])), {"poste": l["poste"]})
    return vue_passation(_passation(id_), Annuaire())


# ----- Absences et intérims -----

STATUTS = ("en_mission", "en_conge", "absent")


class NouvelleAbsence(Strict):
    matricule: str | None = Field(default=None, pattern=MATRICULE, description="Absent : vous-même par défaut")
    statut: Literal["en_mission", "en_conge", "absent"]
    precision: str | None = Field(default=None, max_length=200,
                                  description="Ex. joignable, injoignable, maladie, formation")
    date_debut: date
    date_fin: date
    interimaire: str | None = Field(default=None, pattern=MATRICULE)

    @model_validator(mode="after")
    def dates_coherentes(self):
        if self.date_fin < self.date_debut:
            raise ValueError("La date de fin précède la date de début.")
        return self


class Decision(Strict):
    decision: Literal["validee", "refusee"]
    interimaire: str | None = Field(default=None, pattern=MATRICULE,
                                    description="Le supérieur peut désigner un autre intérimaire")
    motif: str | None = Field(default=None, max_length=500)


def _absence(id_: int) -> dict:
    with base.connexion() as cnx:
        ligne = cnx.execute("SELECT * FROM absences WHERE id = %s", (id_,)).fetchone()
    if not ligne:
        raise introuvable("Aucune absence ne porte ce numéro.")
    return ligne


def validateurs(p: dict) -> list[str]:
    """Titulaires du poste supérieur : ils valident l'intérim."""
    return base.titulaires(p["poste_superieur"]) if p["poste_superieur"] else []


def absent_le(matricule: str, debut: date, fin: date, sauf: int | None = None) -> bool:
    with base.connexion() as cnx:
        return bool(cnx.execute(
            "SELECT 1 FROM absences WHERE matricule = %s AND etat IN ('en_attente', 'validee', 'en_cours') "
            "AND date_debut <= %s AND date_fin >= %s AND id IS DISTINCT FROM %s",
            (matricule, fin, debut, sauf),
        ).fetchone())


def verifier_interimaire(matricule: str, absent: dict, p: dict, debut: date, fin: date, meme_direction: bool) -> None:
    """Garde-fous : agent actif, habilité pour le poste, de la même direction (sauf désignation par le supérieur)."""
    if matricule == valeur(absent, "matricule"):
        raise invalide({"interimaire": "L'agent ne peut pas assurer son propre intérim."})
    fiche = _agent_actif(matricule, "interimaire")
    if meme_direction and valeur(fiche, "direction") != valeur(absent, "direction"):
        raise invalide({"interimaire": "L'intérimaire doit appartenir à la même direction (ou être désigné par le supérieur)."})
    if not _habilite(fiche, p):
        raise invalide({"interimaire": f"Habilitation insuffisante : le poste exige « {p['habilitation_requise']} »."})
    if absent_le(matricule, debut, fin):
        raise invalide({"interimaire": "Cet agent est lui-même absent pendant cette période."})


def vue_absence(a: dict, annuaire: Annuaire, utilisateur: Utilisateur | None = None) -> dict:
    p = base.poste(a["poste"])
    valid = validateurs(p) if p else []
    return {
        "id": a["id"], "agent": annuaire.personne(a["matricule"]), "poste": a["poste"],
        "intitule": p["intitule"] if p else a["poste"], "statut": a["statut"], "precision": a["precision"],
        "date_debut": a["date_debut"].isoformat(), "date_fin": a["date_fin"].isoformat(),
        "interimaire": annuaire.personne(a["interimaire"]), "etat": a["etat"],
        "declaree_par": annuaire.personne(a["declaree_par"]) if a["declaree_par"].isdigit() else None,
        "declaree_le": a["declaree_le"].isoformat(),
        "validateurs": [annuaire.personne(m) for m in valid],
        "validee_par": annuaire.personne(a["validee_par"]), "motif_refus": a["motif_refus"],
        "debut_effectif": a["debut_effectif"].isoformat() if a["debut_effectif"] else None,
        "fin_effective": a["fin_effective"].isoformat() if a["fin_effective"] else None,
        "compte_rendu": a["compte_rendu"],
        "peut_valider": bool(utilisateur) and a["etat"] == "en_attente"
                        and (utilisateur.super_admin or utilisateur.matricule in valid),
    }


def _interimaire_effectif(matricule: str, p: dict, profondeur: int = 0) -> str | None:
    """Intérimaire lui-même absent : remontée vers le titulaire du poste supérieur, sur trois niveaux au plus."""
    with base.connexion() as cnx:
        absent = cnx.execute("SELECT 1 FROM absences WHERE matricule = %s AND etat = 'en_cours'", (matricule,)).fetchone()
    if not absent:
        return matricule
    if profondeur >= PROFONDEUR_MAX or not p["poste_superieur"]:
        return None
    sup = base.titulaires(p["poste_superieur"])
    return _interimaire_effectif(sup[0], base.poste(p["poste_superieur"]), profondeur + 1) if sup else None


def demarrer_interim(id_: int, auteur: str) -> None:
    with _verrou:
        a = _absence(id_)
        if a["etat"] != "validee" or a["date_debut"] > aujourdhui():
            return
        p = base.poste(a["poste"])
        annuaire = Annuaire()
        compte = None
        interimaire = _interimaire_effectif(a["interimaire"], p) if a["interimaire"] else None
        if interimaire:
            existants = [(l["interimaire"], l["date_fin"]) for l in interimaires_en_cours(a["poste"])]
            ordre = {
                "libelle": libelle(p),
                "annonce": f"{annuaire.nom(interimaire)} assure l'intérim de {libelle(p)} jusqu'au "
                           f"{date_longue(a['date_fin'])}, en l'absence de {annuaire.nom(a['matricule'])}.",
                "interimaire": matrix_id(interimaire),
                "titulaires": [matrix_id(m) for m in base.titulaires(a["poste"])],
                # Un salon classé au-dessus de l'habilitation de l'intérimaire lui reste fermé
                "salons": [{"room_id": s["room_id"],
                            "etat": etat_salon(s, interims={a["poste"]: existants + [(interimaire, a["date_fin"])]})}
                           for s in salons_de(a["poste"]) if habilite_pour(interimaire, s["classification"], annuaire)],
            }
            try:
                compte = bot.interim(ordre)
            except ErreurApi as erreur:
                compte = {"erreur": erreur.message, "erreurs": 1}
            if compte.get("erreurs", 1) == 0:
                memoriser_etats(ordre["salons"])
        reussi = compte is None or compte.get("erreurs", 1) == 0
        with base.connexion() as cnx:
            cnx.execute(
                "UPDATE absences SET etat = CASE WHEN %s THEN 'en_cours' ELSE etat END, "
                "debut_effectif = CASE WHEN %s THEN now() ELSE debut_effectif END, interimaire = %s, "
                "compte_rendu = jsonb_set(coalesce(compte_rendu, '{}'), '{debut}', %s) WHERE id = %s",
                (reussi, reussi, interimaire or a["interimaire"], base.Json(compte or {}), id_),
            )
        base.journaliser(auteur, "interim_debut", "succes" if reussi else "echec", interimaire or a["matricule"],
                         ministere_du_poste(p), {"poste": a["poste"], "titulaire": a["matricule"],
                                                 "remontee": interimaire != a["interimaire"]})


def terminer_interim(id_: int, auteur: str, anticipee: bool) -> None:
    with _verrou:
        a = _absence(id_)
        if a["etat"] != "en_cours":
            return
        p = base.poste(a["poste"])
        annuaire = Annuaire()
        compte = None
        fin = aujourdhui() if anticipee else a["date_fin"]
        if a["interimaire"]:
            restants = [(l["interimaire"], l["date_fin"]) for l in interimaires_en_cours(a["poste"])
                        if l["interimaire"] != a["interimaire"]]
            debut = a["debut_effectif"] or datetime.combine(a["date_debut"], datetime.min.time(), timezone.utc)
            ordre = {
                "libelle": libelle(p),
                "annonce": f"Fin de l'intérim : {annuaire.nom(a['matricule'])} reprend la fonction {libelle(p)}.",
                "interimaire": matrix_id(a["interimaire"]), "interimaire_nom": annuaire.nom(a["interimaire"]),
                "titulaires": [matrix_id(m) for m in base.titulaires(a["poste"])],
                "depuis_ms": int(debut.timestamp() * 1000),
                "periode": f"du {date_longue(a['date_debut'])} au {date_longue(fin)}",
                "salons": [{"room_id": s["room_id"], "etat": etat_salon(s, interims={a["poste"]: restants})}
                           for s in salons_de(a["poste"])],
                "compte_rendu_nom": f"FCT-{a['poste']} · compte rendu d'intérim",
            }
            try:
                compte = bot.fin_interim(ordre)
            except ErreurApi as erreur:
                compte = {"erreur": erreur.message, "erreurs": 1}
            if compte.get("erreurs", 1) == 0:
                memoriser_etats(ordre["salons"])
        reussi = compte is None or compte.get("erreurs", 1) == 0
        with base.connexion() as cnx:
            cnx.execute(
                "UPDATE absences SET etat = CASE WHEN %s THEN 'terminee' ELSE etat END, "
                "fin_effective = CASE WHEN %s THEN now() ELSE fin_effective END, "
                "date_fin = CASE WHEN %s AND %s THEN LEAST(date_fin, %s) ELSE date_fin END, "
                "compte_rendu = jsonb_set(coalesce(compte_rendu, '{}'), '{fin}', %s) WHERE id = %s",
                (reussi, reussi, reussi, anticipee, fin, base.Json(compte or {}), id_),
            )
        base.journaliser(auteur, "interim_fin", "succes" if reussi else "echec", a["interimaire"] or a["matricule"],
                         ministere_du_poste(p), {"poste": a["poste"], "titulaire": a["matricule"], "anticipee": anticipee})


@routeur.post("/absences", status_code=201, tags=["Absences et intérims"],
              summary="Déclarer une absence et proposer un intérimaire (validation par le supérieur)",
              responses=_erreurs(401, 403, 404, 409, 422))
def declarer_absence(corps: NouvelleAbsence, utilisateur: Utilisateur = Depends(utilisateur_courant)):
    cible = corps.matricule or utilisateur.matricule
    if not cible:
        raise invalide({"matricule": "Précisez l'agent absent."})
    absent = agent_keycloak(cible)
    ministere = valeur(absent, "ministere")
    if cible != utilisateur.matricule:
        # Pour un autre agent : les RH de son ministère
        controler(utilisateur, "absence", RH, ministere, cible)
    affectation = base.affectation_en_cours(cible)
    if not affectation:
        raise invalide({"matricule": "Cet agent n'occupe aucun poste : aucun intérim à organiser."})
    p = base.poste(affectation["poste"])
    if corps.date_debut < aujourdhui():
        raise invalide({"date_debut": "La date de début ne peut pas être passée."})
    if absent_le(cible, corps.date_debut, corps.date_fin):
        raise conflit("absence_existante", "Une absence est déjà déclarée sur cette période.")
    if corps.interimaire:
        verifier_interimaire(corps.interimaire, absent, p, corps.date_debut, corps.date_fin, meme_direction=True)
    with base.connexion() as cnx:
        id_ = cnx.execute(
            "INSERT INTO absences (matricule, poste, statut, precision, date_debut, date_fin, interimaire, declaree_par) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (cible, p["code"], corps.statut, corps.precision, corps.date_debut, corps.date_fin, corps.interimaire,
             utilisateur.identifiant),
        ).fetchone()["id"]
    base.journaliser(utilisateur.identifiant, "absence", "succes", cible, ministere, {
        "poste": p["code"], "statut": corps.statut, "du": corps.date_debut.isoformat(),
        "au": corps.date_fin.isoformat(), "interimaire": corps.interimaire,
    })
    return vue_absence(_absence(id_), Annuaire(), utilisateur)


@routeur.get("/absences", tags=["Absences et intérims"], summary="Les absences du ministère (à valider, en cours, passées)",
             responses=_erreurs(401, 403, 422))
def lister_absences(ministere: str | None = Query(default=None), etat: str | None = Query(default=None),
                    utilisateur: Utilisateur = Depends(utilisateur_courant)):
    exiger_role(utilisateur, *LECTEURS)
    codes = [p["code"] for p in base.postes_du_ministere(ministere_demande(utilisateur, ministere))]
    with base.connexion() as cnx:
        lignes = cnx.execute(
            "SELECT * FROM absences WHERE poste = ANY(%s) AND (%s::text IS NULL OR etat = %s) ORDER BY date_debut DESC, id DESC",
            (codes, etat, etat),
        ).fetchall()
    annuaire = Annuaire()
    return [vue_absence(a, annuaire, utilisateur) for a in lignes]


@routeur.post("/absences/{id_}/validation", tags=["Absences et intérims"],
              summary="Valider ou refuser l'intérim (titulaire du poste supérieur)",
              responses=_erreurs(401, 403, 404, 409, 422))
def valider_absence(id_: int, corps: Decision, utilisateur: Utilisateur = Depends(utilisateur_courant)):
    a = _absence(id_)
    p = base.poste(a["poste"])
    ministere = ministere_du_poste(p)
    if not (utilisateur.super_admin or utilisateur.matricule in validateurs(p)):
        base.journaliser(utilisateur.identifiant, "absence_validation", "refus", a["matricule"], ministere,
                         {"motif": "Seul le supérieur hiérarchique valide l'intérim."})
        raise interdit("Seul le supérieur hiérarchique de l'agent peut valider cet intérim.")
    if a["etat"] != "en_attente":
        raise conflit("absence_traitee", "Cette demande a déjà été traitée.")
    interimaire = a["interimaire"]
    if corps.decision == "validee" and corps.interimaire and corps.interimaire != interimaire:
        verifier_interimaire(corps.interimaire, agent_keycloak(a["matricule"]), p, a["date_debut"], a["date_fin"],
                             meme_direction=False)
        interimaire = corps.interimaire
    with base.connexion() as cnx:
        cnx.execute(
            "UPDATE absences SET etat = %s, validee_par = %s, validee_le = now(), interimaire = %s, motif_refus = %s "
            "WHERE id = %s",
            (corps.decision, utilisateur.identifiant, interimaire,
             corps.motif if corps.decision == "refusee" else None, id_),
        )
    base.journaliser(utilisateur.identifiant, "absence_validation", "succes", a["matricule"], ministere, {
        "decision": corps.decision, "interimaire": interimaire, "designe_par_le_superieur": interimaire != a["interimaire"],
        "motif": corps.motif,
    })
    if corps.decision == "validee":
        demarrer_interim(id_, utilisateur.identifiant)
    return vue_absence(_absence(id_), Annuaire(), utilisateur)


@routeur.post("/absences/{id_}/fin", tags=["Absences et intérims"],
              summary="Retour anticipé : fin de l'intérim (ou annulation d'une absence pas encore commencée)",
              responses=_erreurs(401, 403, 404, 409))
def finir_absence(id_: int, utilisateur: Utilisateur = Depends(utilisateur_courant)):
    a = _absence(id_)
    p = base.poste(a["poste"])
    ministere = ministere_du_poste(p)
    autorise = (utilisateur.super_admin or utilisateur.matricule == a["matricule"]
                or utilisateur.matricule in validateurs(p)
                or (utilisateur.a_un_role(*RH) and utilisateur.couvre(ministere)))
    if not autorise:
        base.journaliser(utilisateur.identifiant, "interim_fin", "refus", a["matricule"], ministere,
                         {"motif": "Réservé à l'agent, à son supérieur et aux RH."})
        raise interdit("Seuls l'agent, son supérieur et les RH peuvent mettre fin à cette absence.")
    if a["etat"] == "en_cours":
        terminer_interim(id_, utilisateur.identifiant, anticipee=True)
    elif a["etat"] in ("en_attente", "validee"):
        with base.connexion() as cnx:
            cnx.execute("UPDATE absences SET etat = 'annulee' WHERE id = %s", (id_,))
        base.journaliser(utilisateur.identifiant, "absence_annulee", "succes", a["matricule"], ministere,
                         {"poste": a["poste"]})
    else:
        raise conflit("absence_terminee", "Cette absence est déjà terminée.")
    return vue_absence(_absence(id_), Annuaire(), utilisateur)


@routeur.get("/agents/{matricule}/statut", tags=["Absences et intérims"],
             summary="Statut d'un agent et son intérimaire, pour le bandeau de l'application",
             responses=_erreurs(401, 404))
def statut_agent(matricule: str, utilisateur: Utilisateur = Depends(utilisateur_courant)):
    fiche = agent_keycloak(matricule)
    annuaire = Annuaire()
    with base.connexion() as cnx:
        a = cnx.execute(
            "SELECT * FROM absences WHERE matricule = %s AND etat = 'en_cours' ORDER BY date_debut DESC LIMIT 1",
            (matricule,),
        ).fetchone()
    affectation = base.affectation_en_cours(matricule)
    p = base.poste(affectation["poste"]) if affectation else None
    return {
        "agent": {"matricule": matricule, "nom": nom_agent(fiche), "matrix_id": matrix_id(matricule)},
        "statut": a["statut"] if a else "disponible",
        "precision": a["precision"] if a else None,
        "jusqu_au": a["date_fin"].isoformat() if a else None,
        "interimaire": annuaire.personne(a["interimaire"]) if a else None,
        "fonction": {"poste": p["code"], "intitule": p["intitule"]} if p else None,
    }


# ----- Exécution aux dates prévues -----

# Salons de démonstration et leur niveau : DRH ↔ hôpitaux en Diffusion restreinte, DRH ↔ secrétariat général
# en Confidentiel (les titulaires des deux fonctions y sont habilités).
SALONS_DEMO = [("DRH-SANTE", "DH-SANTE", "diffusion_restreinte"), ("DRH-SANTE", "SG-SANTE", "confidentiel")]


def synchroniser_etats() -> None:
    """Réécrit l'état bf.messaf.salon des salons dont la base a changé (niveau, titulaires, intérims)."""
    with base.connexion() as cnx:
        salons = cnx.execute("SELECT * FROM salons_fonction ORDER BY cree_le").fetchall()
    a_ecrire = []
    for s in salons:
        etat = etat_salon(s)
        if etat != s["etat_ecrit"]:
            a_ecrire.append({"room_id": s["room_id"], "etat": etat})
    if not a_ecrire:
        return
    compte = bot.ecrire_etats(a_ecrire)
    echecs = {r["room_id"] for r in compte.get("salons", []) if r.get("erreur")}
    memoriser_etats([e for e in a_ecrire if e["room_id"] not in echecs])
    journal.info("état de %d salon(s) de fonction réécrit", len(a_ecrire) - len(echecs))


def tour() -> None:
    """Passations arrivées à échéance, intérims à ouvrir ou à clore, salons de démonstration."""
    jour = aujourdhui()
    with base.connexion() as cnx:
        passations = cnx.execute("SELECT id FROM passations WHERE statut = 'planifiee' AND date_effet <= %s", (jour,)).fetchall()
        a_ouvrir = cnx.execute("SELECT id FROM absences WHERE etat = 'validee' AND date_debut <= %s", (jour,)).fetchall()
        a_clore = cnx.execute("SELECT id FROM absences WHERE etat = 'en_cours' AND date_fin < %s", (jour,)).fetchall()
    for l in passations:
        executer_passation(l["id"], "planificateur")
    for l in a_ouvrir:
        demarrer_interim(l["id"], "planificateur")
    for l in a_clore:
        terminer_interim(l["id"], "planificateur", anticipee=False)
    if reglages.demo:
        for poste_code, interlocuteur, classification in SALONS_DEMO:
            with base.connexion() as cnx:
                existe = cnx.execute("SELECT classification FROM salons_fonction WHERE poste = %s AND interlocuteur = %s",
                                     (poste_code, interlocuteur)).fetchone()
                if existe and existe["classification"] != classification:
                    # Installation antérieure à la classification : le niveau est posé, l'état suivra
                    cnx.execute("UPDATE salons_fonction SET classification = %s WHERE poste = %s AND interlocuteur = %s",
                                (classification, poste_code, interlocuteur))
            if not existe and base.poste(poste_code) and base.poste(interlocuteur):
                creer_salon_fonction(poste_code, interlocuteur, "demo", classification)
                journal.info("salon de démonstration créé : %s ↔ %s (%s)", poste_code, interlocuteur, classification)
    synchroniser_etats()


class Planificateur(threading.Thread):
    def __init__(self, periode_s: int = 60) -> None:
        super().__init__(name="planificateur", daemon=True)
        self.periode_s = periode_s
        self.arret = threading.Event()

    def run(self) -> None:
        while not self.arret.is_set():
            try:
                tour()
            except Exception as erreur:  # le bot peut ne pas être prêt : nouvel essai au tour suivant
                journal.warning("planificateur : %s", getattr(erreur, "message", erreur))
            self.arret.wait(self.periode_s)

    def arreter(self) -> None:
        self.arret.set()


def demarrer_planificateur() -> Planificateur:
    planificateur = Planificateur()
    planificateur.start()
    return planificateur
