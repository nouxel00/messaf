"""Réglages de l'API, lus dans l'environnement (voir docker-compose.yml).

Aucun secret n'est écrit ici : les secrets des clients Keycloak et MAS sont lus
dans le volume /secrets, et le mot de passe de la base dans PGPASSWORD.
"""
import os
from dataclasses import dataclass, field


def _env(nom: str, defaut: str) -> str:
    return os.environ.get(nom, defaut)


def lire_secret(chemin: str) -> str:
    with open(chemin, encoding="utf-8") as fichier:
        return fichier.read().strip()


@dataclass(frozen=True)
class Reglages:
    # Jetons des utilisateurs du portail : émis par Keycloak, vus depuis le navigateur
    keycloak_issuer: str = _env("KEYCLOAK_ISSUER", "http://localhost:8180/realms/messaf")
    # Keycloak vu depuis l'intérieur de Docker
    keycloak_interne: str = _env("KEYCLOAK_INTERNE", "http://keycloak:8080")
    realm: str = _env("KEYCLOAK_REALM", "messaf")
    # Audience exigée dans les jetons du portail
    audience: str = _env("API_AUDIENCE", "api-messaf")
    # Compte de service de l'API dans Keycloak (gestion des comptes)
    keycloak_client_id: str = _env("KEYCLOAK_API_CLIENT_ID", "api-messaf")
    keycloak_secret_fichier: str = _env("KEYCLOAK_API_SECRET_FILE", "/secrets/keycloak_api")
    # Client d'administration de l'API dans MAS (verrouillage, fermeture des sessions)
    mas_jeton_url: str = _env("MAS_TOKEN_URL", "http://mas:8080/oauth2/token")
    mas_admin_url: str = _env("MAS_ADMIN_URL", "http://mas:8081/api/admin/v1")
    mas_client_id: str = _env("MAS_API_CLIENT_ID", "01M6FHNSXEF2QT59Y8491Q73C3")
    mas_secret_fichier: str = _env("MAS_API_SECRET_FILE", "/secrets/mas_api")
    # Base de l'API (hôte, utilisateur et mot de passe : variables PGHOST, PGUSER, PGPASSWORD)
    base: str = _env("API_DATABASE", "api")
    # Pages web autorisées à appeler l'API (portail de Lionnel)
    origines: list[str] = field(
        default_factory=lambda: _env("API_ORIGINES", "http://localhost:5173,http://localhost:5174").split(",")
    )
    serveur_matrix: str = _env("SYNAPSE_SERVER_NAME", "gov.bf")
    # Adresse du serveur à saisir dans l'application (imprimée sur la fiche d'enrôlement)
    adresse_serveur: str = _env("MESSAF_ADRESSE_SERVEUR", "http://localhost:8008")
    # Bot de fonction : API interne joignable seulement dans Docker, protégée par un secret partagé
    bot_url: str = _env("BOT_URL", "http://bot-fonction:8090")
    bot_secret_fichier: str = _env("BOT_INTERNE_SECRET_FILE", "/secrets/bot_interne")
    # Jeu de données fictif : organigramme, postes et affectations des comptes de démonstration
    demo: bool = _env("MESSAF_DEMO", "0") == "1"


reglages = Reglages()
