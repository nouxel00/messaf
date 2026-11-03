"""Client d'administration Keycloak, avec le compte de service « api-messaf ».

Ce compte n'a que les droits de gestion des utilisateurs du domaine « messaf »
(manage-users, view-users, query-users) : il ne peut pas modifier la
configuration de Keycloak.
"""
import threading
import time

import httpx

from .config import lire_secret, reglages
from .erreurs import conflit, service_indisponible

ACTIONS_PREMIERE_CONNEXION = ["UPDATE_PASSWORD", "CONFIGURE_TOTP", "CONFIGURE_RECOVERY_AUTHN_CODES"]


class KeycloakAdmin:
    def __init__(self) -> None:
        self._http = httpx.Client(base_url=reglages.keycloak_interne, timeout=15, trust_env=False)
        self._jeton: str | None = None
        self._expire = 0.0
        self._verrou = threading.Lock()
        self._base = f"/admin/realms/{reglages.realm}"

    def _entetes(self) -> dict[str, str]:
        with self._verrou:
            if not self._jeton or time.monotonic() > self._expire:
                try:
                    reponse = self._http.post(
                        f"/realms/{reglages.realm}/protocol/openid-connect/token",
                        data={"grant_type": "client_credentials"},
                        auth=(reglages.keycloak_client_id, lire_secret(reglages.keycloak_secret_fichier)),
                    )
                    reponse.raise_for_status()
                except (httpx.HTTPError, OSError) as erreur:
                    raise service_indisponible("Keycloak est injoignable ou refuse le compte de service de l'API.") from erreur
                donnees = reponse.json()
                self._jeton = donnees["access_token"]
                self._expire = time.monotonic() + donnees.get("expires_in", 60) - 20
            return {"Authorization": f"Bearer {self._jeton}"}

    def _appel(self, methode: str, chemin: str, **options) -> httpx.Response:
        try:
            reponse = self._http.request(methode, self._base + chemin, headers=self._entetes(), **options)
        except httpx.HTTPError as erreur:
            raise service_indisponible("Keycloak est injoignable.") from erreur
        if reponse.status_code >= 500:
            raise service_indisponible(f"Keycloak a répondu par une erreur ({reponse.status_code}).")
        return reponse

    # --- Lecture ---

    def utilisateur(self, matricule: str) -> dict | None:
        reponse = self._appel("GET", "/users", params={"username": matricule, "exact": "true", "briefRepresentation": "false"})
        reponse.raise_for_status()
        trouves = [u for u in reponse.json() if u.get("username") == matricule]
        return trouves[0] if trouves else None

    def utilisateurs(self, ministere: str | None) -> list[dict]:
        params = {"max": "1000", "briefRepresentation": "false"}
        if ministere:
            params["q"] = f"ministere:{ministere}"
        reponse = self._appel("GET", "/users", params=params)
        reponse.raise_for_status()
        # Seuls les comptes d'agents ont un matricule (pas les comptes de service)
        return [u for u in reponse.json() if u.get("attributes", {}).get("matricule")]

    # --- Écriture ---

    def creer(self, representation: dict) -> str:
        reponse = self._appel("POST", "/users", json=representation)
        if reponse.status_code == 409:
            raise conflit("matricule_existant", "Ce matricule est déjà utilisé.")
        reponse.raise_for_status()
        return reponse.headers["Location"].rstrip("/").rsplit("/", 1)[-1]

    def modifier(self, identifiant: str, representation: dict) -> None:
        self._appel("PUT", f"/users/{identifiant}", json=representation).raise_for_status()

    def definir_mot_de_passe_provisoire(self, identifiant: str, valeur: str) -> None:
        self._appel(
            "PUT",
            f"/users/{identifiant}/reset-password",
            json={"type": "password", "value": valeur, "temporary": True},
        ).raise_for_status()

    def fermer_sessions(self, identifiant: str) -> None:
        self._appel("POST", f"/users/{identifiant}/logout").raise_for_status()


keycloak = KeycloakAdmin()
