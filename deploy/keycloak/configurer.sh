#!/bin/bash
# Réglages du domaine « messaf » que l'import JSON ne sait pas faire, ou qui doivent
# aussi s'appliquer à une installation existante (l'import n'a lieu qu'une fois).
# Lancé par le service « keycloak-config » (même image que Keycloak), quand Keycloak
# est prêt. Peut être relancé sans risque.
set -euo pipefail

KC=/opt/keycloak/bin/kcadm.sh
CFG=(--config /tmp/kcadm.config)
R=(-r messaf)

for essai in $(seq 1 60); do
  if "$KC" config credentials "${CFG[@]}" --server http://keycloak:8080 --realm master \
       --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null 2>&1; then
    break
  fi
  echo "Attente de Keycloak (essai $essai)..."
  sleep 5
done

id_client() {
  "$KC" get clients "${CFG[@]}" "${R[@]}" -q "clientId=$1" --fields id --format csv --noquotes
}

# 1. Codes de secours : proposés à la connexion comme alternative au code TOTP,
#    par le lien « Essayer une autre méthode » (téléphone perdu ou changé).
ID=""
while IFS=, read -r id fournisseur exigence priorite; do
  if [ "$fournisseur" = "auth-recovery-authn-code-form" ]; then
    ID=$id; EXIGENCE=$exigence; PRIORITE=$priorite
  fi
done < <("$KC" get authentication/flows/browser/executions "${CFG[@]}" "${R[@]}" \
           --fields id,providerId,requirement,priority --format csv --noquotes)
if [ -z "$ID" ]; then
  echo "Étape « codes de secours » introuvable dans le flux de connexion" >&2
  exit 1
fi
if [ "$EXIGENCE" = "ALTERNATIVE" ]; then
  echo "Codes de secours : déjà acceptés à la connexion"
else
  "$KC" update authentication/flows/browser/executions "${CFG[@]}" "${R[@]}" \
    -b "{\"id\":\"$ID\",\"requirement\":\"ALTERNATIVE\",\"priority\":$PRIORITE}"
  echo "Codes de secours : acceptés à la connexion"
fi

# 2. Compte de service de l'API d'administration : gestion des comptes d'agents uniquement.
SECRET_API=$(cat /secrets/keycloak_api)
ID_API=$(id_client api-messaf)
if [ -z "$ID_API" ]; then
  "$KC" create clients "${CFG[@]}" "${R[@]}" -s clientId=api-messaf -s "name=API d'administration MESSAF" \
    -s enabled=true -s publicClient=false -s serviceAccountsEnabled=true -s standardFlowEnabled=false \
    -s directAccessGrantsEnabled=false -s implicitFlowEnabled=false -s "secret=$SECRET_API"
  echo "Client api-messaf : créé"
else
  "$KC" update "clients/$ID_API" "${CFG[@]}" "${R[@]}" -s "secret=$SECRET_API"
  echo "Client api-messaf : secret synchronisé"
fi
"$KC" add-roles "${CFG[@]}" "${R[@]}" --uusername service-account-api-messaf --cclientid realm-management \
  --rolename manage-users --rolename view-users --rolename query-users
echo "Client api-messaf : droits de gestion des comptes"

# 3. Portail : adresses de développement de Vite, documentation de l'API (/docs) et jetons destinés à l'API.
ID_PORTAIL=$(id_client portail)
if [ -n "$ID_PORTAIL" ]; then
  "$KC" update "clients/$ID_PORTAIL" "${CFG[@]}" "${R[@]}" \
    -s 'redirectUris=["http://localhost:5173/*","http://localhost:5174/*","http://localhost:8000/docs/oauth2-redirect"]' \
    -s 'webOrigins=["http://localhost:5173","http://localhost:5174","http://localhost:8000"]' \
    -s 'attributes."post.logout.redirect.uris"=http://localhost:5173/*##http://localhost:5174/*'
  MAPPEURS=$("$KC" get "clients/$ID_PORTAIL/protocol-mappers/models" "${CFG[@]}" "${R[@]}" --fields name --format csv --noquotes)
  if [[ $'\n'"$MAPPEURS"$'\n' == *$'\n'audience-api$'\n'* ]]; then
    echo "Portail : audience de l'API déjà présente"
  else
    "$KC" create "clients/$ID_PORTAIL/protocol-mappers/models" "${CFG[@]}" "${R[@]}" \
      -s name=audience-api -s protocol=openid-connect -s protocolMapper=oidc-audience-mapper \
      -s 'config."included.custom.audience"=api-messaf' -s 'config."access.token.claim"=true' \
      -s 'config."id.token.claim"=false' -s 'config."introspection.token.claim"=true'
    echo "Portail : audience de l'API ajoutée"
  fi
fi
