"""Vérification des jetons Keycloak du portail et règles d'accès.

Chaque requête porte le jeton de l'utilisateur connecté au portail
(en-tête Authorization: Bearer). L'API vérifie sa signature avec les clés
publiques de Keycloak, son émetteur, son audience et sa date d'expiration.
"""
from dataclasses import dataclass

import jwt
from fastapi import Depends
from fastapi.security import OAuth2AuthorizationCodeBearer

from .config import reglages
from .erreurs import interdit, non_authentifie

ROLES = {"super_admin", "admin_ministere", "gestionnaire_rh", "superieur", "auditeur", "archiviste"}

# Décrit la connexion Keycloak dans la documentation (bouton « Authorize » de /docs)
# et lit le jeton dans l'en-tête Authorization: Bearer.
schema_oauth = OAuth2AuthorizationCodeBearer(
    authorizationUrl=f"{reglages.keycloak_issuer}/protocol/openid-connect/auth",
    tokenUrl=f"{reglages.keycloak_issuer}/protocol/openid-connect/token",
    scopes={"openid": "Identité de l'utilisateur"},
    auto_error=False,
)

_cles = jwt.PyJWKClient(
    f"{reglages.keycloak_interne}/realms/{reglages.realm}/protocol/openid-connect/certs",
    cache_keys=True,
    lifespan=300,
)


@dataclass(frozen=True)
class Utilisateur:
    identifiant: str
    matricule: str | None
    nom: str
    roles: frozenset[str]
    ministere: str | None

    @property
    def super_admin(self) -> bool:
        return "super_admin" in self.roles

    def a_un_role(self, *roles: str) -> bool:
        return self.super_admin or bool(self.roles.intersection(roles))

    def couvre(self, ministere: str | None) -> bool:
        """Vrai si le ministère fait partie du périmètre de l'utilisateur."""
        return self.super_admin or (ministere is not None and ministere == self.ministere)


def decoder(jeton: str) -> dict:
    try:
        cle = _cles.get_signing_key_from_jwt(jeton)
        return jwt.decode(
            jeton,
            cle.key,
            algorithms=["RS256"],
            audience=reglages.audience,
            issuer=reglages.keycloak_issuer,
            options={"require": ["exp", "iat", "iss", "sub"]},
            leeway=10,
        )
    except jwt.PyJWKClientError as erreur:
        raise non_authentifie("Impossible de vérifier le jeton : Keycloak est injoignable.") from erreur
    except jwt.InvalidTokenError as erreur:
        raise non_authentifie("Jeton invalide ou expiré. Reconnectez-vous.") from erreur


def utilisateur_courant(jeton: str | None = Depends(schema_oauth)) -> Utilisateur:
    """Dépendance FastAPI : l'utilisateur authentifié, ou une erreur 401."""
    if not jeton:
        raise non_authentifie()
    claims = decoder(jeton)
    roles = frozenset(r for r in claims.get("realm_access", {}).get("roles", []) if r in ROLES)
    return Utilisateur(
        identifiant=claims.get("preferred_username") or claims["sub"],
        matricule=claims.get("matricule"),
        nom=claims.get("name") or claims.get("preferred_username") or "",
        roles=roles,
        ministere=claims.get("ministere"),
    )


def exiger_role(utilisateur: Utilisateur, *roles: str) -> None:
    if not utilisateur.a_un_role(*roles):
        raise interdit("Votre rôle ne permet pas cette opération.")


def exiger_perimetre(utilisateur: Utilisateur, ministere: str | None) -> None:
    if not utilisateur.couvre(ministere):
        raise interdit("Cet agent ou ce ministère est hors de votre périmètre.")
