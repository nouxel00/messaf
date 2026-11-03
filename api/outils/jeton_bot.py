"""Crée le compte Matrix du bot de fonction et son jeton d'accès, au premier démarrage.

Lancé une fois par le service « bot-init » (image de l'API, compte root), avec le volume des secrets en écriture.
Utilise l'API d'administration de MAS (client de l'API MESSAF) : compte @bot-fonction:gov.bf,
puis une session personnelle (jeton sans mot de passe) liée à un appareil propre au bot.
Ne refait rien si le jeton existe déjà.
"""
import os
import secrets
import sys
import time

import httpx

SECRETS = os.environ.get("SECRETS_DIR", "/secrets")
MAS_TOKEN_URL = os.environ.get("MAS_TOKEN_URL", "http://mas:8080/oauth2/token")
MAS_ADMIN_URL = os.environ.get("MAS_ADMIN_URL", "http://mas:8081/api/admin/v1")
MAS_CLIENT_ID = os.environ.get("MAS_API_CLIENT_ID", "01M6FHNSXEF2QT59Y8491Q73C3")
UTILISATEUR = os.environ.get("BOT_LOCALPART", "bot-fonction")

fichier_jeton = os.path.join(SECRETS, "bot_fonction_jeton")
fichier_appareil = os.path.join(SECRETS, "bot_fonction_appareil")
if os.path.exists(fichier_jeton) and os.path.exists(fichier_appareil):
    print("Jeton du bot de fonction : déjà présent")
    sys.exit(0)

http = httpx.Client(timeout=30, trust_env=False)
secret_client = open(os.path.join(SECRETS, "mas_api"), encoding="utf-8").read().strip()

for essai in range(60):
    try:
        reponse = http.post(MAS_TOKEN_URL, data={"grant_type": "client_credentials", "scope": "urn:mas:admin"},
                            auth=(MAS_CLIENT_ID, secret_client))
        reponse.raise_for_status()
        break
    except httpx.HTTPError:
        print("Attente de MAS...")
        time.sleep(5)
else:
    sys.exit("MAS ne répond pas")
entetes = {"Authorization": f"Bearer {reponse.json()['access_token']}"}

compte = http.get(f"{MAS_ADMIN_URL}/users/by-username/{UTILISATEUR}", headers=entetes)
if compte.status_code == 404:
    compte = http.post(f"{MAS_ADMIN_URL}/users", headers=entetes, json={"username": UTILISATEUR})
    compte.raise_for_status()
    print(f"Compte @{UTILISATEUR} : créé")
else:
    compte.raise_for_status()
identifiant = compte.json()["data"]["id"]

# Un appareil neuf à chaque nouveau jeton : le magasin de clés du bot lui est propre
appareil = "BOTFONCTION" + secrets.token_hex(4).upper()
session = http.post(f"{MAS_ADMIN_URL}/personal-sessions", headers=entetes, json={
    "actor_user_id": identifiant,
    "human_name": "Bot de fonction MESSAF",
    "scope": f"urn:matrix:client:api:* urn:matrix:client:device:{appareil}",
})
session.raise_for_status()
jeton = session.json()["data"]["attributes"]["access_token"]

# Le jeton n'est lisible que par le compte du bot (uid 10002 dans son image)
UID_BOT = int(os.environ.get("BOT_UID", "10002"))
for chemin, valeur, mode in ((fichier_appareil, appareil, 0o644), (fichier_jeton, jeton, 0o600)):
    fd = os.open(chemin, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, mode)
    with os.fdopen(fd, "w", encoding="utf-8") as fichier:
        fichier.write(valeur)
    os.chmod(chemin, mode)
    if os.geteuid() == 0:
        os.chown(chemin, UID_BOT, UID_BOT)
print(f"Jeton du bot de fonction : créé (appareil {appareil})")
