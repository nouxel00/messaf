"""Erreurs renvoyées au portail, au format attendu : {"message", "code", "champs"}."""


class ErreurApi(Exception):
    def __init__(self, statut: int, code: str, message: str, champs: dict[str, str] | None = None):
        super().__init__(message)
        self.statut = statut
        self.code = code
        self.message = message
        self.champs = champs

    def corps(self) -> dict:
        corps = {"message": self.message, "code": self.code}
        if self.champs:
            corps["champs"] = self.champs
        return corps


def non_authentifie(message: str = "Connexion requise.") -> ErreurApi:
    return ErreurApi(401, "non_authentifie", message)


def interdit(message: str = "Vous n'êtes pas autorisé à effectuer cette opération pour ce périmètre.") -> ErreurApi:
    return ErreurApi(403, "interdit", message)


def introuvable(message: str = "Élément introuvable.") -> ErreurApi:
    return ErreurApi(404, "introuvable", message)


def conflit(code: str, message: str) -> ErreurApi:
    return ErreurApi(409, code, message)


def invalide(champs: dict[str, str], message: str = "Les informations envoyées ont été refusées.") -> ErreurApi:
    return ErreurApi(422, "donnees_invalides", message, champs)


def service_indisponible(message: str) -> ErreurApi:
    return ErreurApi(503, "service_indisponible", message)
