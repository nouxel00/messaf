"""Tests automatisés des fonctions de sécurité de MESSAF, contre la pile en marche.

Lancement, depuis la racine du dépôt, la pile démarrée (docker compose up -d) :

    docker compose --profile tests run --rm tests

Les tests tournent dans l'image de l'API, à l'intérieur du réseau Docker : ils interrogent Synapse, MAS,
Keycloak et la base de données comme le ferait un inspecteur. Ils n'utilisent que des comptes fictifs.
"""
import os
import secrets
import time
import unittest

import httpx
import psycopg

from messaf_api import base, main
from messaf_api.keycloak import keycloak
from messaf_api.mas import mas
from messaf_api.modeles import Motif
from messaf_api.securite import Utilisateur

SYNAPSE = os.environ.get("SYNAPSE_URL", "http://synapse:8008")
# Agent fictif sans rôle, absent des salons de fonction de démonstration : Fatimata Diallo
AGENT_ESSAI = os.environ.get("AGENT_ESSAI", "100008")
# Synapse garde en mémoire la validité d'un jeton pendant deux minutes au plus
DELAI_REVOCATION_MAX = int(os.environ.get("DELAI_REVOCATION_MAX", "150"))

http = httpx.Client(timeout=15, trust_env=False)
ADMIN_TESTS = Utilisateur(identifiant="tests-automatises", matricule=None, nom="Tests automatisés",
                          roles=frozenset({"super_admin"}), ministere=None)


def synapse(methode: str, chemin: str, jeton: str | None = None, **options) -> httpx.Response:
    entetes = {"Authorization": f"Bearer {jeton}"} if jeton else {}
    return http.request(methode, f"{SYNAPSE}/_matrix/client/v3{chemin}", headers=entetes, **options)


def base_synapse():
    return psycopg.connect(dbname="synapse")


def session_essai(matricule: str) -> tuple[str, str]:
    """Une session MESSAF pour l'agent, ouverte par l'API d'administration de MAS : (jeton, id de session)."""
    compte = mas.utilisateur(f"m{matricule}")
    if compte is None:
        # Agent qui ne s'est jamais connecté : son compte Matrix est créé, Keycloak le reprendra à sa connexion
        compte = mas._verifier(mas._appel("POST", "/users", json={"username": f"m{matricule}"})).json()["data"]
    appareil = "ESSAI" + secrets.token_hex(4).upper()
    session = mas._verifier(mas._appel("POST", "/personal-sessions", json={
        "actor_user_id": compte["id"],
        "human_name": "Test automatisé MESSAF",
        "scope": f"urn:matrix:client:api:* urn:matrix:client:device:{appareil}",
    })).json()["data"]
    return session["attributes"]["access_token"], session["id"]


def fermer_session(id_session: str) -> None:
    mas._appel("POST", f"/personal-sessions/{id_session}/revoke")


def setUpModule():
    base.ouvrir()


def tearDownModule():
    base.fermer()


class LeServeurNeLitRien(unittest.TestCase):
    """Épreuve « le serveur ne lit rien » : la base de Synapse ne contient aucun message en clair."""

    def test_tous_les_salons_sont_chiffres(self):
        with base_synapse() as cnx:
            non_chiffres = cnx.execute(
                "SELECT r.room_id FROM rooms r WHERE NOT EXISTS (SELECT 1 FROM current_state_events c "
                "WHERE c.room_id = r.room_id AND c.type = 'm.room.encryption')"
            ).fetchall()
        self.assertEqual(non_chiffres, [], "salons sans chiffrement de bout en bout")

    def test_aucun_message_en_clair(self):
        with base_synapse() as cnx:
            en_clair = cnx.execute("SELECT count(*) FROM events WHERE type IN ('m.room.message', 'm.sticker')").fetchone()[0]
            chiffres = cnx.execute("SELECT count(*) FROM events WHERE type = 'm.room.encrypted'").fetchone()[0]
        self.assertEqual(en_clair, 0, "messages stockés en clair")
        print(f"\n    {chiffres} message(s) stocké(s), tous chiffrés (m.room.encrypted)")

    def test_les_messages_chiffres_ne_contiennent_pas_de_texte(self):
        with base_synapse() as cnx:
            contenus = cnx.execute(
                "SELECT j.json::jsonb -> 'content' FROM events e JOIN event_json j USING (event_id) "
                "WHERE e.type = 'm.room.encrypted' ORDER BY e.stream_ordering DESC LIMIT 50"
            ).fetchall()
        for (contenu,) in contenus:
            self.assertIn("ciphertext", contenu)
            self.assertNotIn("body", contenu)


class Intrus(unittest.TestCase):
    """Épreuve « intrus » : aucun compte ne peut être créé ni utilisé sans enrôlement."""

    def test_inscription_fermee(self):
        reponse = synapse("POST", "/register", json={"username": "intrus", "password": secrets.token_urlsafe(16)})
        self.assertNotEqual(reponse.status_code, 200)
        self.assertNotIn("access_token", reponse.text)

    def test_connexion_par_mot_de_passe_refusee(self):
        flux = [f["type"] for f in synapse("GET", "/login").json().get("flows", [])]
        self.assertNotIn("m.login.password", flux, "Synapse ne doit pas accepter de mot de passe : tout passe par Keycloak")
        reponse = synapse("POST", "/login", json={
            "type": "m.login.password", "identifier": {"type": "m.id.user", "user": f"m{AGENT_ESSAI}"},
            "password": secrets.token_urlsafe(16),
        })
        self.assertNotEqual(reponse.status_code, 200)

    def test_federation_fermee(self):
        reponse = http.get(f"{SYNAPSE}/_matrix/federation/v1/version")
        self.assertEqual(reponse.status_code, 404, "l'API de fédération ne doit pas être servie")

    def test_jeton_inconnu_refuse(self):
        reponse = synapse("GET", "/account/whoami", jeton=secrets.token_urlsafe(32))
        self.assertEqual(reponse.status_code, 401)

    def test_agent_non_invite_ne_peut_pas_rejoindre_un_salon_de_fonction(self):
        with base.connexion() as cnx:
            salon = cnx.execute("SELECT room_id, nom FROM salons_fonction ORDER BY cree_le LIMIT 1").fetchone()
        if not salon:
            self.skipTest("aucun salon de fonction")
        jeton, id_session = session_essai(AGENT_ESSAI)
        try:
            reponse = synapse("POST", f"/join/{salon['room_id']}", jeton=jeton, json={})
            self.assertEqual(reponse.status_code, 403, f"{salon['nom']} ouvert à un agent non invité")
        finally:
            fermer_session(id_session)


class Revocation(unittest.TestCase):
    """Épreuve « révocation » : le compte est bloqué et ses sessions ne fonctionnent plus."""

    def test_revocation_coupe_l_acces(self):
        jeton, _ = session_essai(AGENT_ESSAI)
        self.assertEqual(synapse("GET", "/account/whoami", jeton=jeton).status_code, 200)
        debut = time.monotonic()
        resultat = main.revoquer(AGENT_ESSAI, Motif(motif="Test automatisé de la révocation"), utilisateur=ADMIN_TESTS)
        try:
            self.assertEqual(resultat["etat"], "revoque")
            self.assertGreaterEqual(resultat["sessions_fermees"], 1)
            self.assertFalse(keycloak.utilisateur(AGENT_ESSAI)["enabled"], "le compte Keycloak doit être désactivé")
            # Le jeton cesse de fonctionner dès que Synapse ne le garde plus en mémoire
            while synapse("GET", "/account/whoami", jeton=jeton).status_code == 200:
                self.assertLess(time.monotonic() - debut, DELAI_REVOCATION_MAX, "le jeton fonctionne encore")
                time.sleep(2)
            print(f"\n    {resultat['sessions_fermees']} session(s) fermée(s), jeton refusé après "
                  f"{time.monotonic() - debut:.0f} s")
        finally:
            main.reactiver(AGENT_ESSAI, Motif(motif="Fin du test automatisé de la révocation"), utilisateur=ADMIN_TESTS)


if __name__ == "__main__":
    unittest.main(verbosity=2)
