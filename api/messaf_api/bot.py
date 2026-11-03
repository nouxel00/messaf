"""Client de l'API interne du bot de fonction (salons de fonction, passations, intérims).

Le bot n'est joignable qu'à l'intérieur de Docker ; chaque ordre porte le secret partagé
/secrets/bot_interne. Le bot exécute dans Matrix et rend un compte rendu par salon.
"""
import httpx

from .config import lire_secret, reglages
from .erreurs import service_indisponible


class BotFonction:
    def __init__(self) -> None:
        # Une passation touche plusieurs salons : l'ordre peut prendre quelques secondes
        self._http = httpx.Client(timeout=180, trust_env=False)

    def _ordre(self, chemin: str, corps: dict) -> dict:
        try:
            reponse = self._http.post(
                reglages.bot_url + chemin,
                json=corps,
                headers={"Authorization": f"Bearer {lire_secret(reglages.bot_secret_fichier)}"},
            )
        except (httpx.HTTPError, OSError) as erreur:
            raise service_indisponible("Le bot de fonction est injoignable.") from erreur
        if reponse.is_error:
            try:
                detail = reponse.json().get("message", "")
            except ValueError:
                detail = reponse.text[:200]
            raise service_indisponible(f"Le bot de fonction n'a pas pu exécuter l'ordre : {detail}")
        return reponse.json()

    def creer_salon(self, nom: str, sujet: str, etat: dict, membres: list[str]) -> str:
        return self._ordre("/interne/salons", {"nom": nom, "sujet": sujet, "etat": etat, "membres": membres})["room_id"]

    def passation(self, ordre: dict) -> dict:
        return self._ordre("/interne/passation", ordre)

    def interim(self, ordre: dict) -> dict:
        return self._ordre("/interne/interim", ordre)

    def fin_interim(self, ordre: dict) -> dict:
        return self._ordre("/interne/fin-interim", ordre)


bot = BotFonction()
