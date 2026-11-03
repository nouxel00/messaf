"""Corps JSON reçus par l'API, au format préparé par le portail (services/agents.api.ts)."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Habilitation = Literal["normal", "diffusion_restreinte", "confidentiel"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class IdentiteEntree(Strict):
    matricule: str = Field(pattern=r"^[0-9]{6}$", description="6 chiffres")
    nom: str = Field(min_length=1, max_length=100)
    prenoms: str = Field(min_length=1, max_length=150)
    email: str | None = Field(default=None, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    telephone: str | None = Field(default=None, max_length=30, pattern=r"^[0-9+ ().-]{6,30}$")


class AnnuaireEntree(Strict):
    email: bool = True
    telephone: bool = False


class ProfilEntree(Strict):
    ministere: str = Field(min_length=1, max_length=64)
    direction: str = Field(min_length=1, max_length=64)
    service: str = Field(min_length=1, max_length=64)
    annuaire: AnnuaireEntree = AnnuaireEntree()


class AffectationEntree(Strict):
    poste: str = Field(min_length=1, max_length=64)
    date_debut: date
    date_fin: date | None = None

    @model_validator(mode="after")
    def dates_coherentes(self):
        if self.date_fin is not None and self.date_fin < self.date_debut:
            raise ValueError("La date de fin précède la date de début.")
        return self


class NouvelAgent(Strict):
    identite: IdentiteEntree
    profil: ProfilEntree
    habilitation: Habilitation
    affectation: AffectationEntree


class Motif(Strict):
    motif: str | None = Field(default=None, max_length=500)
