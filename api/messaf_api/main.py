"""API d'administration de MESSAF (jalon 1) : agents, enrôlement, révocation, audit.

Appelée par le portail de Lionnel, avec le jeton Keycloak de l'utilisateur connecté.
Documentation interactive : http://localhost:8000/docs
"""
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import base, demo, fiche
from .config import reglages
from .erreurs import ErreurApi, conflit, introuvable, invalide
from .keycloak import ACTIONS_PREMIERE_CONNEXION, keycloak
from .mas import mas
from .modeles import Motif, NouvelAgent
from .securite import Utilisateur, exiger_perimetre, exiger_role, utilisateur_courant

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s : %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)

# Messages de validation en français, pour le portail
MESSAGES_VALIDATION = {
    "missing": "Champ obligatoire.",
    "string_too_short": "Champ obligatoire.",
    "string_too_long": "Texte trop long.",
    "string_pattern_mismatch": "Format invalide.",
    "literal_error": "Valeur non autorisée.",
    "extra_forbidden": "Champ inconnu.",
    "date_parsing": "Date invalide (format AAAA-MM-JJ).",
    "date_from_datetime_parsing": "Date invalide (format AAAA-MM-JJ).",
    "bool_parsing": "Valeur oui/non attendue.",
    "string_type": "Texte attendu.",
    "model_attributes_type": "Objet attendu.",
    "json_invalid": "Corps JSON invalide.",
}

LECTEURS = ("gestionnaire_rh", "admin_ministere")
ENROLEURS = ("gestionnaire_rh",)
REVOCATEURS = ("admin_ministere",)
AUDITEURS = ("auditeur",)


@asynccontextmanager
async def cycle_de_vie(_app: FastAPI):
    base.ouvrir()
    if reglages.demo:
        demo.charger()
    yield
    base.fermer()


app = FastAPI(
    title="API d'administration MESSAF",
    version="1.0.0",
    description="Enrôlement, révocation et audit des agents. Chaque appel exige un jeton Keycloak du domaine messaf : "
                "dans cette page, bouton « Authorize », puis connexion avec un compte du domaine (mot de passe et code TOTP).",
    lifespan=cycle_de_vie,
    # Connexion depuis la documentation interactive, avec le client public « portail » et PKCE
    swagger_ui_init_oauth={"clientId": "portail", "usePkceWithAuthorizationCodeGrant": True, "scopes": "openid"},
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=reglages.origines,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def entetes_de_securite(request: Request, suivant):
    reponse = await suivant(request)
    # Les réponses contiennent des données personnelles : aucune mise en cache
    reponse.headers["Cache-Control"] = "no-store"
    reponse.headers["X-Content-Type-Options"] = "nosniff"
    return reponse


@app.exception_handler(ErreurApi)
async def erreur_api(_request: Request, erreur: ErreurApi):
    return JSONResponse(status_code=erreur.statut, content=erreur.corps())


@app.exception_handler(RequestValidationError)
async def erreur_validation(_request: Request, erreur: RequestValidationError):
    champs = {}
    for detail in erreur.errors():
        chemin = ".".join(str(p) for p in detail["loc"] if p != "body")
        message = MESSAGES_VALIDATION.get(detail["type"])
        if not message:  # erreur métier (ex. dates incohérentes) : message déjà en français
            message = str(detail.get("ctx", {}).get("error", detail["msg"]))
        champs[chemin or "corps"] = message
    return JSONResponse(status_code=422, content=invalide(champs).corps())


@app.exception_handler(StarletteHTTPException)
async def erreur_http(_request: Request, erreur: StarletteHTTPException):
    code = "introuvable" if erreur.status_code == 404 else "erreur"
    return JSONResponse(status_code=erreur.status_code, content={"message": str(erreur.detail), "code": code})


# --- Outils ---

def _valeur(utilisateur: dict, attribut: str) -> str | None:
    valeurs = utilisateur.get("attributes", {}).get(attribut) or [None]
    return valeurs[0]


def _matrix_id(matricule: str) -> str:
    return f"@m{matricule}:{reglages.serveur_matrix}"


def _iso(horodatage_ms: int | None) -> str | None:
    if not horodatage_ms:
        return None
    return datetime.fromtimestamp(horodatage_ms / 1000, tz=timezone.utc).isoformat()


def _vue_agent(utilisateur: dict) -> dict:
    """Vue consolidée d'un agent : Keycloak (identité, sécurité) + base de l'API (annuaire, affectation)."""
    matricule = _valeur(utilisateur, "matricule") or utilisateur["username"]
    profil = base.profil(matricule) or {}
    affectation = base.affectation_en_cours(matricule)
    poste = base.poste(affectation["poste"]) if affectation else None
    return {
        "identite": {
            "matricule": matricule,
            "nom": utilisateur.get("lastName", ""),
            "prenoms": utilisateur.get("firstName", ""),
            "email": utilisateur.get("email"),
            "telephone": profil.get("telephone"),
        },
        "profil": {
            "ministere": _valeur(utilisateur, "ministere"),
            "direction": _valeur(utilisateur, "direction"),
            "service": _valeur(utilisateur, "service"),
            "annuaire": {
                "email": profil.get("annuaire_email", True),
                "telephone": profil.get("annuaire_telephone", False),
            },
        },
        "habilitation": _valeur(utilisateur, "habilitation"),
        "etat": _valeur(utilisateur, "etat") or ("actif" if utilisateur.get("enabled") else "suspendu"),
        "matrix_id": _matrix_id(matricule),
        # « en_attente » tant que l'agent n'a pas fait sa première connexion avec le code d'activation
        "enrolement": "en_attente" if "UPDATE_PASSWORD" in (utilisateur.get("requiredActions") or []) else "termine",
        "affectation": {
            "poste": affectation["poste"],
            "date_debut": affectation["date_debut"].isoformat(),
            "date_fin": affectation["date_fin"].isoformat() if affectation["date_fin"] else None,
        } if affectation else None,
        "poste": poste,
        "cree_le": _iso(utilisateur.get("createdTimestamp")),
    }


def _agent_keycloak(matricule: str) -> dict:
    utilisateur = keycloak.utilisateur(matricule)
    if not utilisateur or not _valeur(utilisateur, "matricule"):
        raise introuvable("Aucun agent ne porte ce matricule.")
    return utilisateur


def _controler(utilisateur: Utilisateur, action: str, roles: tuple, ministere: str | None, cible: str | None) -> None:
    """Contrôle d'accès d'une action sensible ; tout refus est inscrit au journal d'audit."""
    try:
        exiger_role(utilisateur, *roles)
        exiger_perimetre(utilisateur, ministere)
    except ErreurApi as erreur:
        base.journaliser(utilisateur.identifiant, action, "refus", cible, ministere, {"motif": erreur.message})
        raise


def _ministere_demande(utilisateur: Utilisateur, ministere: str | None) -> str:
    ministere = ministere or utilisateur.ministere
    if not ministere:
        raise invalide({"ministere": "Précisez le ministère."})
    exiger_perimetre(utilisateur, ministere)
    return ministere


# --- Routes ---

@app.get("/sante", tags=["Service"], summary="L'API répond")
def sante():
    return {"statut": "ok"}


@app.get("/moi", tags=["Service"], summary="L'utilisateur connecté, tel que l'API le voit")
def moi(utilisateur: Utilisateur = Depends(utilisateur_courant)):
    return {
        "identifiant": utilisateur.identifiant,
        "matricule": utilisateur.matricule,
        "nom": utilisateur.nom,
        "roles": sorted(utilisateur.roles),
        "ministere": utilisateur.ministere,
    }


@app.get("/structures", tags=["Référentiel"], summary="Le ministère et toutes ses directions et services")
def structures(ministere: str | None = Query(default=None), utilisateur: Utilisateur = Depends(utilisateur_courant)):
    exiger_role(utilisateur, *LECTEURS)
    return base.structures_du_ministere(_ministere_demande(utilisateur, ministere))


@app.get("/postes", tags=["Référentiel"], summary="Les postes rattachés aux structures du ministère")
def postes(ministere: str | None = Query(default=None), utilisateur: Utilisateur = Depends(utilisateur_courant)):
    exiger_role(utilisateur, *LECTEURS)
    return base.postes_du_ministere(_ministere_demande(utilisateur, ministere))


@app.get("/agents", tags=["Agents"], summary="Les agents d'un ministère")
def lister_agents(ministere: str | None = Query(default=None), utilisateur: Utilisateur = Depends(utilisateur_courant)):
    exiger_role(utilisateur, *LECTEURS)
    ministere = _ministere_demande(utilisateur, ministere)
    agents = [_vue_agent(u) for u in keycloak.utilisateurs(ministere)]
    return sorted(agents, key=lambda a: a["identite"]["matricule"])


@app.get("/agents/{matricule}", tags=["Agents"], summary="Un agent")
def obtenir_agent(matricule: str, utilisateur: Utilisateur = Depends(utilisateur_courant)):
    exiger_role(utilisateur, *LECTEURS)
    agent = _agent_keycloak(matricule)
    exiger_perimetre(utilisateur, _valeur(agent, "ministere"))
    return _vue_agent(agent)


@app.post("/agents", status_code=201, tags=["Agents"], summary="Créer un agent (son enrôlement commence)")
def creer_agent(nouvel: NouvelAgent, utilisateur: Utilisateur = Depends(utilisateur_courant)):
    identite, profil, affectation = nouvel.identite, nouvel.profil, nouvel.affectation
    _controler(utilisateur, "creation_agent", ENROLEURS, profil.ministere, identite.matricule)

    # Cohérence avec l'organigramme : ministère > direction > service, poste du ministère
    champs = {}
    ministere = base.structure(profil.ministere)
    direction = base.structure(profil.direction)
    service = base.structure(profil.service)
    if not ministere or ministere["type"] != "ministere":
        champs["profil.ministere"] = "Ministère inconnu."
    if not direction or direction["type"] != "direction" or direction["parent"] != profil.ministere:
        champs["profil.direction"] = "Cette direction n'appartient pas au ministère."
    if not service or service["type"] != "service" or service["parent"] != profil.direction:
        champs["profil.service"] = "Ce service n'appartient pas à la direction."
    poste = base.poste(affectation.poste)
    structures_ministere = {s["code"] for s in base.structures_du_ministere(profil.ministere)}
    if not poste or poste["structure"] not in structures_ministere:
        champs["affectation.poste"] = "Ce poste n'existe pas dans le ministère."
    if champs:
        raise invalide(champs)

    identifiant = keycloak.creer({
        "username": identite.matricule,
        "enabled": True,
        "firstName": identite.prenoms,
        "lastName": identite.nom,
        "email": identite.email,
        "attributes": {
            "matricule": [identite.matricule],
            "ministere": [profil.ministere],
            "direction": [profil.direction],
            "service": [profil.service],
            "habilitation": [nouvel.habilitation],
            "etat": ["actif"],
        },
        # Aucun mot de passe tant que la fiche d'enrôlement n'est pas émise
        "requiredActions": ACTIONS_PREMIERE_CONNEXION,
    })
    base.enregistrer_agent(identite.matricule, identite.telephone, profil.annuaire.email, profil.annuaire.telephone,
                           affectation.poste, affectation.date_debut, affectation.date_fin)
    base.journaliser(utilisateur.identifiant, "creation_agent", "succes", identite.matricule, profil.ministere,
                     {"poste": affectation.poste, "habilitation": nouvel.habilitation, "keycloak_id": identifiant})
    return {
        "matricule": identite.matricule,
        "matrix_id": _matrix_id(identite.matricule),
        "etat": "actif",
        "enrolement": "en_attente",
        "cree_le": datetime.now(timezone.utc).isoformat(),
    }


@app.get(
    "/agents/{matricule}/fiche-enrolement",
    tags=["Agents"],
    summary="Fiche PDF avec un nouveau code d'activation (le précédent est annulé)",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def fiche_enrolement(matricule: str, utilisateur: Utilisateur = Depends(utilisateur_courant)):
    agent = _agent_keycloak(matricule)
    ministere = _valeur(agent, "ministere")
    _controler(utilisateur, "fiche_enrolement", ENROLEURS, ministere, matricule)
    if _valeur(agent, "etat") == "revoque" or not agent.get("enabled"):
        raise conflit("compte_revoque", "Ce compte est révoqué : aucune fiche ne peut être émise.")
    if "UPDATE_PASSWORD" not in (agent.get("requiredActions") or []):
        raise conflit("deja_active", "Cet agent a déjà activé son compte : la fiche d'enrôlement n'est plus disponible.")

    code = fiche.nouveau_code()
    keycloak.definir_mot_de_passe_provisoire(agent["id"], code)
    vue = _vue_agent(agent)
    min_ = base.structure(ministere) if ministere else None
    dir_ = base.structure(vue["profil"]["direction"]) if vue["profil"]["direction"] else None
    pdf = fiche.generer(
        {
            "nom": vue["identite"]["nom"],
            "prenoms": vue["identite"]["prenoms"],
            "matricule": matricule,
            "matrix_id": vue["matrix_id"],
            "ministere_libelle": min_["libelle"] if min_ else ministere,
            "direction_libelle": dir_["libelle"] if dir_ else vue["profil"]["direction"],
            "poste_intitule": vue["poste"]["intitule"] if vue["poste"] else None,
            "habilitation": vue["habilitation"],
        },
        code,
        reglages.adresse_serveur,
        f"{utilisateur.nom} ({utilisateur.identifiant})",
    )
    base.journaliser(utilisateur.identifiant, "fiche_enrolement", "succes", matricule, ministere)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="fiche-enrolement-{matricule}.pdf"'},
    )


@app.post("/agents/{matricule}/revocation", tags=["Agents"], summary="Révoquer : Keycloak bloqué, sessions MAS fermées")
def revoquer(matricule: str, corps: Motif | None = None, utilisateur: Utilisateur = Depends(utilisateur_courant)):
    agent = _agent_keycloak(matricule)
    ministere = _valeur(agent, "ministere")
    _controler(utilisateur, "revocation", REVOCATEURS, ministere, matricule)
    if utilisateur.identifiant == matricule:
        raise conflit("auto_revocation", "Vous ne pouvez pas révoquer votre propre compte.")
    motif = corps.motif if corps else None

    # 1. Keycloak : plus aucune connexion possible
    agent["enabled"] = False
    agent.setdefault("attributes", {})["etat"] = ["revoque"]
    keycloak.modifier(agent["id"], agent)
    keycloak.fermer_sessions(agent["id"])

    # 2. MAS : compte verrouillé et toutes les sessions des applications fermées
    sessions = 0
    try:
        compte = mas.utilisateur(f"m{matricule}")
        if compte:
            mas.verrouiller(compte["id"])
            sessions = mas.fermer_sessions(compte["id"])
    except ErreurApi as erreur:
        base.journaliser(utilisateur.identifiant, "revocation", "echec", matricule, ministere,
                         {"motif": motif, "etape": "mas", "erreur": erreur.message})
        raise ErreurApi(503, "revocation_partielle",
                        "Le compte est bloqué dans Keycloak, mais MAS n'a pas répondu : relancez la révocation.") from erreur

    base.journaliser(utilisateur.identifiant, "revocation", "succes", matricule, ministere,
                     {"motif": motif, "sessions_fermees": sessions})
    return {"matricule": matricule, "etat": "revoque", "sessions_fermees": sessions}


@app.post("/agents/{matricule}/reactivation", tags=["Agents"], summary="Réactiver un compte révoqué")
def reactiver(matricule: str, corps: Motif | None = None, utilisateur: Utilisateur = Depends(utilisateur_courant)):
    agent = _agent_keycloak(matricule)
    ministere = _valeur(agent, "ministere")
    _controler(utilisateur, "reactivation", REVOCATEURS, ministere, matricule)

    agent["enabled"] = True
    agent.setdefault("attributes", {})["etat"] = ["actif"]
    keycloak.modifier(agent["id"], agent)
    compte = mas.utilisateur(f"m{matricule}")
    if compte:
        mas.deverrouiller(compte["id"])
    base.journaliser(utilisateur.identifiant, "reactivation", "succes", matricule, ministere,
                     {"motif": corps.motif if corps else None})
    return {"matricule": matricule, "etat": "actif"}


@app.get("/audit", tags=["Audit"], summary="Journal d'audit, du plus récent au plus ancien")
def audit(
    ministere: str | None = Query(default=None),
    limite: int = Query(default=100, ge=1, le=1000),
    utilisateur: Utilisateur = Depends(utilisateur_courant),
):
    exiger_role(utilisateur, *AUDITEURS)
    if not utilisateur.super_admin:
        ministere = _ministere_demande(utilisateur, ministere)
    lignes = base.journal(ministere, limite)
    for ligne in lignes:
        ligne["horodatage"] = ligne["horodatage"].isoformat()
    return lignes
