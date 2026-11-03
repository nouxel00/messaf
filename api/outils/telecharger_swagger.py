"""Télécharge Swagger UI pendant la construction de l'image de l'API.

La documentation interactive (/docs) est ainsi servie par l'API elle-même,
sans appel à un site extérieur : elle fonctionne aussi sans Internet.
L'archive est vérifiée par son empreinte SHA-512 avant d'être utilisée.
"""
import base64
import hashlib
import io
import os
import sys
import tarfile
import urllib.request

VERSION = "5.33.3"  # Swagger UI, licence Apache-2.0
EMPREINTE = "sha512-7xJKxAjf+/ajlW/V/dMfbiY+NC5BWtbvzzdI/AsX5UzMtOMudmFz/tjuKN0jN7QVe5drKKnx01CdYEJvTFvQlw=="
FICHIERS = ("swagger-ui-bundle.js", "swagger-ui.css", "favicon-32x32.png", "LICENSE")

destination = sys.argv[1]
adresse = f"https://registry.npmjs.org/swagger-ui-dist/-/swagger-ui-dist-{VERSION}.tgz"
archive = urllib.request.urlopen(adresse, timeout=300).read()

calculee = "sha512-" + base64.b64encode(hashlib.sha512(archive).digest()).decode()
if calculee != EMPREINTE:
    sys.exit(f"Empreinte inattendue pour Swagger UI {VERSION} : téléchargement refusé")

os.makedirs(destination, exist_ok=True)
with tarfile.open(fileobj=io.BytesIO(archive)) as paquet:
    for nom in FICHIERS:
        contenu = paquet.extractfile(paquet.getmember(f"package/{nom}")).read()
        with open(os.path.join(destination, nom), "wb") as fichier:
            fichier.write(contenu)
print(f"Swagger UI {VERSION} installé dans {destination}")
