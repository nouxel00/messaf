"""Base de l'API : organigramme, postes, affectations, informations d'annuaire et journal d'audit.

L'identité et la sécurité du compte restent dans Keycloak ; les messages dans Synapse.
"""
import json
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb as Json  # noqa: F401  (comptes rendus en jsonb)
from psycopg_pool import ConnectionPool

from .config import reglages

SCHEMA = """
CREATE TABLE IF NOT EXISTS structures (
    code     text PRIMARY KEY,
    libelle  text NOT NULL,
    sigle    text,
    type     text NOT NULL CHECK (type IN ('ministere', 'direction', 'service')),
    parent   text REFERENCES structures (code)
);

CREATE TABLE IF NOT EXISTS postes (
    code                 text PRIMARY KEY,
    intitule             text NOT NULL,
    structure            text NOT NULL REFERENCES structures (code),
    poste_superieur      text,
    habilitation_requise text NOT NULL CHECK (habilitation_requise IN ('normal', 'diffusion_restreinte', 'confidentiel'))
);

CREATE TABLE IF NOT EXISTS profils (
    matricule          text PRIMARY KEY,
    telephone          text,
    annuaire_email     boolean NOT NULL DEFAULT true,
    annuaire_telephone boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS affectations (
    id         bigserial PRIMARY KEY,
    matricule  text NOT NULL,
    poste      text NOT NULL REFERENCES postes (code),
    date_debut date NOT NULL,
    date_fin   date,
    CHECK (date_fin IS NULL OR date_fin >= date_debut)
);
CREATE INDEX IF NOT EXISTS affectations_matricule ON affectations (matricule);

-- Salons de fonction (créés par le bot) : un salon relie deux fonctions, par exemple DRH-SANTE et
-- DH-SANTE. Il appartient aux deux : une passation sur l'un ou l'autre poste le touche.
CREATE TABLE IF NOT EXISTS salons_fonction (
    room_id       text PRIMARY KEY,
    poste         text NOT NULL REFERENCES postes (code),
    interlocuteur text NOT NULL REFERENCES postes (code),
    nom           text NOT NULL,
    cree_par      text NOT NULL,
    cree_le       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (poste, interlocuteur),
    CHECK (poste <> interlocuteur)
);

-- Passations de service : une affectation se clôt, une autre s'ouvre sur le même poste.
CREATE TABLE IF NOT EXISTS passations (
    id           bigserial PRIMARY KEY,
    poste        text NOT NULL REFERENCES postes (code),
    sortant      text,
    entrant      text NOT NULL,
    date_effet   date NOT NULL,
    motif        text,
    statut       text NOT NULL DEFAULT 'planifiee' CHECK (statut IN ('planifiee', 'executee', 'echec', 'annulee')),
    demandee_par text NOT NULL,
    demandee_le  timestamptz NOT NULL DEFAULT now(),
    executee_le  timestamptz,
    compte_rendu jsonb
);

-- Absences et intérims : déclarés par l'agent (ou les RH), validés par le supérieur hiérarchique.
CREATE TABLE IF NOT EXISTS absences (
    id             bigserial PRIMARY KEY,
    matricule      text NOT NULL,
    poste          text NOT NULL REFERENCES postes (code),
    statut         text NOT NULL CHECK (statut IN ('en_mission', 'en_conge', 'absent')),
    precision      text,
    date_debut     date NOT NULL,
    date_fin       date NOT NULL,
    interimaire    text,
    etat           text NOT NULL DEFAULT 'en_attente'
                   CHECK (etat IN ('en_attente', 'validee', 'refusee', 'en_cours', 'terminee', 'annulee')),
    declaree_par   text NOT NULL,
    declaree_le    timestamptz NOT NULL DEFAULT now(),
    validee_par    text,
    validee_le     timestamptz,
    motif_refus    text,
    debut_effectif timestamptz,
    fin_effective  timestamptz,
    compte_rendu   jsonb,
    CHECK (date_fin >= date_debut),
    CHECK (interimaire IS NULL OR interimaire <> matricule)
);
CREATE INDEX IF NOT EXISTS absences_matricule ON absences (matricule);

CREATE TABLE IF NOT EXISTS audit (
    id         bigserial PRIMARY KEY,
    horodatage timestamptz NOT NULL DEFAULT now(),
    auteur     text NOT NULL,
    action     text NOT NULL,
    cible      text,
    ministere  text,
    resultat   text NOT NULL CHECK (resultat IN ('succes', 'refus', 'echec')),
    detail     jsonb
);

-- Le journal d'audit est en ajout seul : ni modification ni suppression, ligne à ligne (UPDATE, DELETE)
-- ou d'un coup (TRUNCATE, que les déclencheurs ligne à ligne ne voient pas).
CREATE OR REPLACE FUNCTION audit_ajout_seul() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Le journal d''audit est en ajout seul';
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_ajout_seul ON audit;
CREATE TRIGGER audit_ajout_seul BEFORE UPDATE OR DELETE ON audit
    FOR EACH ROW EXECUTE FUNCTION audit_ajout_seul();
DROP TRIGGER IF EXISTS audit_sans_vidage ON audit;
CREATE TRIGGER audit_sans_vidage BEFORE TRUNCATE ON audit
    FOR EACH STATEMENT EXECUTE FUNCTION audit_ajout_seul();
"""

_pool: ConnectionPool | None = None


def creer_base_si_absente() -> None:
    """Crée la base de l'API sur une installation existante (init.sql ne s'exécute qu'une fois)."""
    with psycopg.connect(dbname="postgres", autocommit=True) as connexion:
        existe = connexion.execute("SELECT 1 FROM pg_database WHERE datname = %s", (reglages.base,)).fetchone()
        if not existe:
            connexion.execute(f'CREATE DATABASE "{reglages.base}"')


def ouvrir() -> None:
    global _pool
    creer_base_si_absente()
    _pool = ConnectionPool(kwargs={"dbname": reglages.base, "row_factory": dict_row}, min_size=1, max_size=5, open=True)
    with connexion() as cnx:
        cnx.execute(SCHEMA)


def fermer() -> None:
    if _pool:
        _pool.close()


@contextmanager
def connexion():
    assert _pool is not None, "base non ouverte"
    with _pool.connection() as cnx:
        yield cnx


# --- Organigramme et postes ---

def structures_du_ministere(ministere: str) -> list[dict]:
    with connexion() as cnx:
        return cnx.execute(
            """
            WITH RECURSIVE arbre AS (
                SELECT * FROM structures WHERE code = %s AND type = 'ministere'
                UNION ALL
                SELECT s.* FROM structures s JOIN arbre a ON s.parent = a.code
            )
            SELECT code, libelle, sigle, type, parent FROM arbre
            ORDER BY CASE type WHEN 'ministere' THEN 0 WHEN 'direction' THEN 1 ELSE 2 END, code
            """,
            (ministere,),
        ).fetchall()


def structure(code: str) -> dict | None:
    with connexion() as cnx:
        return cnx.execute("SELECT code, libelle, sigle, type, parent FROM structures WHERE code = %s", (code,)).fetchone()


def postes_du_ministere(ministere: str) -> list[dict]:
    codes = [s["code"] for s in structures_du_ministere(ministere)]
    if not codes:
        return []
    with connexion() as cnx:
        return cnx.execute(
            "SELECT code, intitule, structure, poste_superieur, habilitation_requise FROM postes "
            "WHERE structure = ANY(%s) ORDER BY code",
            (codes,),
        ).fetchall()


def poste(code: str) -> dict | None:
    with connexion() as cnx:
        return cnx.execute(
            "SELECT code, intitule, structure, poste_superieur, habilitation_requise FROM postes WHERE code = %s",
            (code,),
        ).fetchone()


# --- Agents : annuaire et affectations ---

def profil(matricule: str) -> dict | None:
    with connexion() as cnx:
        return cnx.execute("SELECT * FROM profils WHERE matricule = %s", (matricule,)).fetchone()


def affectation_en_cours(matricule: str) -> dict | None:
    with connexion() as cnx:
        return cnx.execute(
            "SELECT matricule, poste, date_debut, date_fin FROM affectations "
            "WHERE matricule = %s AND date_debut <= current_date AND (date_fin IS NULL OR date_fin >= current_date) "
            "ORDER BY date_debut DESC LIMIT 1",
            (matricule,),
        ).fetchone()


def titulaires(poste_code: str) -> list[str]:
    """Matricules des titulaires actuels d'un poste (plusieurs pour un secrétariat, aucun s'il est vacant)."""
    with connexion() as cnx:
        lignes = cnx.execute(
            "SELECT DISTINCT matricule FROM affectations WHERE poste = %s AND date_debut <= current_date "
            "AND (date_fin IS NULL OR date_fin >= current_date) ORDER BY matricule",
            (poste_code,),
        ).fetchall()
    return [l["matricule"] for l in lignes]


def postes_occupes(matricule: str) -> list[str]:
    """Postes qu'un agent occupe aujourd'hui (en général un seul)."""
    with connexion() as cnx:
        lignes = cnx.execute(
            "SELECT DISTINCT poste FROM affectations WHERE matricule = %s AND date_debut <= current_date "
            "AND (date_fin IS NULL OR date_fin >= current_date) ORDER BY poste",
            (matricule,),
        ).fetchall()
    return [l["poste"] for l in lignes]


def cloturer_affectations(cnx, matricule: str, postes: list[str], date_effet) -> None:
    """Fin d'affectation la veille de la date d'effet.

    Les dates sont comptées en jours : une affectation qui commençait le jour même (deux passations
    le même jour) est supprimée. Le registre des passations et le journal d'audit en gardent la trace.
    """
    cnx.execute("DELETE FROM affectations WHERE matricule = %s AND poste = ANY(%s) AND date_debut >= %s",
                (matricule, postes, date_effet))
    cnx.execute(
        "UPDATE affectations SET date_fin = %s::date - 1 "
        "WHERE matricule = %s AND poste = ANY(%s) AND (date_fin IS NULL OR date_fin >= %s)",
        (date_effet, matricule, postes, date_effet),
    )


def historique_titulaires(poste_code: str) -> list[dict]:
    with connexion() as cnx:
        return cnx.execute(
            "SELECT matricule, date_debut, date_fin FROM affectations WHERE poste = %s ORDER BY date_debut DESC",
            (poste_code,),
        ).fetchall()


def enregistrer_agent(matricule: str, telephone: str | None, annuaire_email: bool, annuaire_telephone: bool,
                      poste_code: str, date_debut, date_fin) -> None:
    with connexion() as cnx:
        cnx.execute(
            "INSERT INTO profils (matricule, telephone, annuaire_email, annuaire_telephone) VALUES (%s, %s, %s, %s) "
            "ON CONFLICT (matricule) DO UPDATE SET telephone = EXCLUDED.telephone, "
            "annuaire_email = EXCLUDED.annuaire_email, annuaire_telephone = EXCLUDED.annuaire_telephone",
            (matricule, telephone, annuaire_email, annuaire_telephone),
        )
        cnx.execute(
            "INSERT INTO affectations (matricule, poste, date_debut, date_fin) VALUES (%s, %s, %s, %s)",
            (matricule, poste_code, date_debut, date_fin),
        )


# --- Journal d'audit ---

def journaliser(auteur: str, action: str, resultat: str, cible: str | None = None,
                ministere: str | None = None, detail: dict | None = None) -> None:
    with connexion() as cnx:
        cnx.execute(
            "INSERT INTO audit (auteur, action, cible, ministere, resultat, detail) VALUES (%s, %s, %s, %s, %s, %s)",
            (auteur, action, cible, ministere, resultat, json.dumps(detail, ensure_ascii=False) if detail else None),
        )


def journal(ministere: str | None, limite: int) -> list[dict]:
    with connexion() as cnx:
        if ministere is None:
            return cnx.execute("SELECT * FROM audit ORDER BY id DESC LIMIT %s", (limite,)).fetchall()
        return cnx.execute(
            "SELECT * FROM audit WHERE ministere = %s ORDER BY id DESC LIMIT %s", (ministere, limite)
        ).fetchall()
