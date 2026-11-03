"""Base de l'API : organigramme, postes, affectations, informations d'annuaire et journal d'audit.

L'identité et la sécurité du compte restent dans Keycloak ; les messages dans Synapse.
"""
import json
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
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
            "WHERE matricule = %s AND (date_fin IS NULL OR date_fin >= current_date) "
            "ORDER BY date_debut DESC LIMIT 1",
            (matricule,),
        ).fetchone()


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
