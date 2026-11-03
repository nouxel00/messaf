"""Client de l'API d'administration de MAS (sessions des applications Matrix).

Utilisé pour la révocation : verrouiller l'agent et fermer toutes ses sessions.
L'API d'administration de MAS n'est servie que sur son port interne (8081),
qui n'est pas publié hors de Docker.
"""
import threading
import time

import httpx

from .config import lire_secret, reglages
from .erreurs import service_indisponible

TYPES_SESSIONS = ("oauth2-sessions", "compat-sessions", "user-sessions")


class MasAdmin:
    def __init__(self) -> None:
        self._http = httpx.Client(timeout=15, trust_env=False)
        self._jeton: str | None = None
        self._expire = 0.0
        self._verrou = threading.Lock()

    def _entetes(self) -> dict[str, str]:
        with self._verrou:
            if not self._jeton or time.monotonic() > self._expire:
                try:
                    reponse = self._http.post(
                        reglages.mas_jeton_url,
                        data={"grant_type": "client_credentials", "scope": "urn:mas:admin"},
                        auth=(reglages.mas_client_id, lire_secret(reglages.mas_secret_fichier)),
                    )
                    reponse.raise_for_status()
                except (httpx.HTTPError, OSError) as erreur:
                    raise service_indisponible("MAS est injoignable ou refuse le client de l'API.") from erreur
                donnees = reponse.json()
                self._jeton = donnees["access_token"]
                self._expire = time.monotonic() + donnees.get("expires_in", 60) - 20
            return {"Authorization": f"Bearer {self._jeton}"}

    def _appel(self, methode: str, chemin: str, **options) -> httpx.Response:
        try:
            reponse = self._http.request(methode, reglages.mas_admin_url + chemin, headers=self._entetes(), **options)
        except httpx.HTTPError as erreur:
            raise service_indisponible("MAS est injoignable.") from erreur
        if reponse.status_code >= 500:
            raise service_indisponible(f"MAS a répondu par une erreur ({reponse.status_code}).")
        return reponse

    def utilisateur(self, localpart: str) -> dict | None:
        """Compte MAS d'un agent, ou None s'il ne s'est encore jamais connecté."""
        reponse = self._appel("GET", f"/users/by-username/{localpart}")
        if reponse.status_code == 404:
            return None
        reponse.raise_for_status()
        return reponse.json()["data"]

    def verrouiller(self, identifiant: str) -> None:
        self._appel("POST", f"/users/{identifiant}/lock").raise_for_status()

    def deverrouiller(self, identifiant: str) -> None:
        self._appel("POST", f"/users/{identifiant}/unlock").raise_for_status()

    def fermer_sessions(self, identifiant: str) -> int:
        """Ferme toutes les sessions actives de l'agent ; renvoie leur nombre."""
        fermees = 0
        for type_session in TYPES_SESSIONS:
            for _page in range(50):  # au plus 5 000 sessions par type, par sécurité
                reponse = self._appel(
                    "GET",
                    f"/{type_session}",
                    params={"filter[user]": identifiant, "filter[status]": "active", "page[first]": "100"},
                )
                reponse.raise_for_status()
                sessions = reponse.json().get("data", [])
                if not sessions:
                    break
                for session in sessions:
                    self._appel("POST", f"/{type_session}/{session['id']}/finish").raise_for_status()
                    fermees += 1
        return fermees


mas = MasAdmin()
