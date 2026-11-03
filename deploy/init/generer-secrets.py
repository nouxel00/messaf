#!/usr/bin/env python3
"""Génère, au premier démarrage, les secrets internes de la pile MESSAF.

Lancé par le service « secrets » de docker-compose, avec l'image de Synapse
(qui contient Python et la bibliothèque cryptography). Les fichiers sont écrits
dans le volume /secrets, partagé uniquement avec les conteneurs qui en ont
besoin. Un fichier existant n'est jamais remplacé : changer ces secrets ferait
perdre les sessions et les données chiffrées de MAS.

Aucun de ces secrets n'est dans le dépôt Git.
"""
import os
import secrets

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa

DOSSIER = "/secrets"
# Compte du bot de fonction dans son image (bots/fonction/Dockerfile)
UID_BOT = 10002


def ecrire(nom: str, fabriquer, proprietaire: int | None = None) -> None:
    """Par défaut lisible par les comptes de Synapse, MAS, Keycloak et de l'API (utilisateurs différents) ;
    avec `proprietaire`, réservé à ce seul compte."""
    chemin = os.path.join(DOSSIER, nom)
    if os.path.exists(chemin):
        print(f"{nom} : déjà présent, conservé")
        return
    fd = os.open(chemin, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600 if proprietaire is not None else 0o644)
    with os.fdopen(fd, "wb") as fichier:
        fichier.write(fabriquer())
    if proprietaire is not None:
        os.chown(chemin, proprietaire, proprietaire)
    print(f"{nom} : créé")


def pem(cle) -> bytes:
    return cle.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )


os.makedirs(os.path.join(DOSSIER, "mas_cles"), exist_ok=True)

# Secret partagé entre Synapse et MAS (provisionnement des comptes, vérification des jetons)
ecrire("synapse_mas", lambda: secrets.token_hex(32).encode())
# Clé des macarons de Synapse (jetons internes de courte durée)
ecrire("synapse_macaroon", lambda: secrets.token_hex(32).encode())
# Secret du client « mas » dans Keycloak
ecrire("keycloak_mas", lambda: secrets.token_urlsafe(32).encode())
# Secret du compte de service « api-messaf » dans Keycloak (gestion des comptes par l'API)
ecrire("keycloak_api", lambda: secrets.token_urlsafe(32).encode())
# Secret du client d'administration de l'API dans MAS (révocation)
ecrire("mas_api", lambda: secrets.token_urlsafe(32).encode())
# Clé de chiffrement de MAS : 32 octets en hexadécimal
ecrire("mas_chiffrement", lambda: secrets.token_hex(32).encode())
# Clés de signature des jetons émis par MAS : RSA obligatoire, ECDSA P-256 en plus
ecrire("mas_cles/rsa.pem", lambda: pem(rsa.generate_private_key(public_exponent=65537, key_size=2048)))
ecrire("mas_cles/ec_p256.pem", lambda: pem(ec.generate_private_key(ec.SECP256R1())))
# Bot de fonction : secret partagé avec l'API pour son API interne (ordres de passation et d'intérim)
ecrire("bot_interne", lambda: secrets.token_urlsafe(32).encode())
# Phrase de chiffrement du magasin de clés du bot, lisible par le seul compte du bot (uid 10002)
ecrire("bot_fonction_magasin", lambda: secrets.token_urlsafe(32).encode(), proprietaire=UID_BOT)
