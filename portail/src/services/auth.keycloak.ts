import { config } from '@/config/env';
import type { SessionUtilisateur } from '@/types/auth';
import { ROLES, type Role } from '@/types/messaf';
import type { AuthService } from './auth.service';
import { NonDisponibleError } from './errors';

/**
 * Raccordement à Keycloak — PRÉPARÉ, NON CONNECTÉ.
 *
 * Le portail est un client public (aucun secret côté navigateur) qui utilisera le flux
 * « Authorization Code » avec PKCE. Pour l'activer :
 *   1. installer l'adaptateur officiel : npm install keycloak-js ;
 *   2. remplir VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM, VITE_KEYCLOAK_CLIENT_ID ;
 *   3. implémenter restaurer/connecter/deconnecter/jeton avec keycloak.init({ onLoad: 'check-sso', pkceMethod: 'S256' }),
 *      keycloak.login(), keycloak.logout(), keycloak.updateToken(30) ;
 *   4. construire la session avec sessionDepuisJeton(keycloak.tokenParsed).
 * Tant que ce n'est pas fait, toute tentative de connexion échoue avec un message explicite.
 */

const nonRaccorde = () =>
  new NonDisponibleError(
    config.keycloak.url
      ? "La connexion Keycloak est préparée mais pas encore raccordée dans le portail. Utilisez le mode démonstration (VITE_AUTH_MODE=demo)."
      : 'Keycloak n’est pas configuré (VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM, VITE_KEYCLOAK_CLIENT_ID).',
  );

/**
 * Lecture des informations du jeton.
 * HYPOTHÈSES À VALIDER AVEC AXEL : rôles de realm dans `realm_access.roles`, attributs
 * `matricule` et `ministere` exposés dans le jeton par des « protocol mappers ».
 */
export function sessionDepuisJeton(claims: Record<string, unknown>): SessionUtilisateur {
  const realm = (claims.realm_access as { roles?: string[] } | undefined)?.roles ?? [];
  const roles = realm.filter((r): r is Role => (ROLES as readonly string[]).includes(r));
  const texte = (cle: string) => (typeof claims[cle] === 'string' ? (claims[cle] as string) : undefined);
  return {
    identifiant: texte('preferred_username') ?? texte('sub') ?? '',
    nomComplet: texte('name') ?? texte('preferred_username') ?? '',
    matricule: texte('matricule'),
    roles,
    ministere: texte('ministere') ?? '',
    ouverteLe: new Date().toISOString(),
    source: 'keycloak',
  };
}

export const authKeycloak: AuthService = {
  mode: 'keycloak',
  async restaurer() {
    return null;
  },
  async connecter() {
    throw nonRaccorde();
  },
  async deconnecter() {
    /* rien à fermer tant que Keycloak n'est pas raccordé */
  },
  async jeton() {
    return null;
  },
};
