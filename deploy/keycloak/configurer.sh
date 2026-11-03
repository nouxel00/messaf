#!/bin/bash
# Réglages du domaine « messaf » que l'import JSON ne sait pas faire.
# Lancé une fois par le service « keycloak-config » (même image que Keycloak),
# quand Keycloak est prêt. Peut être relancé sans risque.
set -euo pipefail

KC=/opt/keycloak/bin/kcadm.sh
CFG=(--config /tmp/kcadm.config)

for essai in $(seq 1 60); do
  if "$KC" config credentials "${CFG[@]}" --server http://keycloak:8080 --realm master \
       --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD" >/dev/null 2>&1; then
    break
  fi
  echo "Attente de Keycloak (essai $essai)..."
  sleep 5
done

# Codes de secours : proposés à la connexion comme alternative au code TOTP,
# par le lien « Essayer une autre méthode » (téléphone perdu ou changé).
ID=""
while IFS=, read -r id fournisseur exigence priorite; do
  if [ "$fournisseur" = "auth-recovery-authn-code-form" ]; then
    ID=$id; EXIGENCE=$exigence; PRIORITE=$priorite
  fi
done < <("$KC" get authentication/flows/browser/executions "${CFG[@]}" -r messaf \
           --fields id,providerId,requirement,priority --format csv --noquotes)
if [ -z "$ID" ]; then
  echo "Étape « codes de secours » introuvable dans le flux de connexion" >&2
  exit 1
fi

if [ "$EXIGENCE" = "ALTERNATIVE" ]; then
  echo "Codes de secours : déjà acceptés à la connexion"
else
  "$KC" update authentication/flows/browser/executions "${CFG[@]}" -r messaf \
    -b "{\"id\":\"$ID\",\"requirement\":\"ALTERNATIVE\",\"priority\":$PRIORITE}"
  echo "Codes de secours : acceptés à la connexion"
fi
