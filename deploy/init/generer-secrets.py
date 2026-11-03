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


def ecrire(nom: str, fabriquer) -> None:
    chemin = os.path.join(DOSSIER, nom)
    if os.path.exists(chemin):
        print(f"{nom} : déjà présent, conservé")
        return
    # Lisible par les comptes de Synapse, MAS et Keycloak (utilisateurs différents)
    fd = os.open(chemin, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    with os.fdopen(fd, "wb") as fichier:
        fichier.write(fabriquer())
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
