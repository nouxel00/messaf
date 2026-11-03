import Keycloak from 'keycloak-js';
import { config } from '@/config/env';
import type { SessionUtilisateur } from '@/types/auth';
import { ROLES, type Role } from '@/types/messaf';
import type { AuthService } from './auth.service';
import { ApiError, NonDisponibleError } from './errors';

/**
 * Connexion par Keycloak : domaine `messaf`, client public `portail`.
 *
 * - Flux « Authorization Code » avec PKCE (S256) : l'identifiant, le mot de passe et le code
 *   à 6 chiffres sont saisis sur la page de Keycloak, jamais dans le portail. Aucun secret
 *   n'est présent dans le navigateur.
 * - Au chargement, une vérification silencieuse (iframe vers public/silent-check-sso.html)
 *   reprend la session Keycloak si elle existe, sans redirection visible.
 * - Le jeton d'accès ne dure que 5 minutes : il est renouvelé avant chaque appel à l'API.
 * - Les jetons restent en mémoire, jamais dans le localStorage : un rechargement de la page
 *   les redemande à Keycloak.
 */

const { url, realm, clientId } = config.keycloak;
const keycloak = url && realm && clientId ? new Keycloak({ url, realm, clientId }) : null;

const nonConfigure = () =>
  new NonDisponibleError('Keycloak n’est pas configuré (VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM, VITE_KEYCLOAK_CLIENT_ID).');

/** Marge de validité exigée avant un appel : en dessous, le jeton est renouvelé. */
const MARGE_JETON_SECONDES = 30;

let initialisation: Promise<boolean> | null = null;
let surExpiration: (() => void) | undefined;

/** Une seule initialisation par page (React StrictMode lance les effets deux fois en développement). */
function initialiser(kc: Keycloak): Promise<boolean> {
  initialisation ??= kc.init({
    onLoad: 'check-sso',
    pkceMethod: 'S256',
    silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
    checkLoginIframe: false,
  });
  return initialisation;
}

/**
 * Lecture des informations du jeton d'accès. Le client `portail` y ajoute les attributs
 * `matricule`, `ministere` (code de structure, ex. `sante`) et `habilitation` ; les rôles
 * sont ceux du domaine, dans `realm_access.roles`.
 */
export function sessionDepuisJeton(claims: Record<string, unknown>): SessionUtilisateur {
  const realmRoles = (claims.realm_access as { roles?: string[] } | undefined)?.roles ?? [];
  const roles = realmRoles.filter((r): r is Role => (ROLES as readonly string[]).includes(r));
  const texte = (cle: string) => (typeof claims[cle] === 'string' ? (claims[cle] as string) : undefined);
  // Heure de la connexion à Keycloak (et non du chargement de la page), en secondes
  const authTime = typeof claims.auth_time === 'number' ? claims.auth_time : undefined;
  return {
    identifiant: texte('preferred_username') ?? texte('sub') ?? '',
    nomComplet: texte('name') ?? texte('preferred_username') ?? '',
    matricule: texte('matricule'),
    roles,
    ministere: texte('ministere') ?? '',
    ouverteLe: new Date(authTime ? authTime * 1000 : Date.now()).toISOString(),
    source: 'keycloak',
  };
}

export const authKeycloak: AuthService = {
  mode: 'keycloak',

  async restaurer() {
    if (!keycloak) return null;
    try {
      const connecte = await initialiser(keycloak);
      return connecte && keycloak.tokenParsed ? sessionDepuisJeton(keycloak.tokenParsed) : null;
    } catch (erreur) {
      // Keycloak injoignable : la page de connexion s'affiche, le bouton réessaiera
      console.warn('Vérification de la session Keycloak impossible', erreur);
      return null;
    }
  },

  async connecter() {
    if (!keycloak) throw nonConfigure();
    try {
      await initialiser(keycloak);
    } catch {
      /* la redirection vers Keycloak reste possible */
    }
    await keycloak.login({ redirectUri: `${window.location.origin}/` });
    // La page part vers Keycloak : cette promesse ne se termine jamais.
    return new Promise<SessionUtilisateur>(() => {});
  },

  async deconnecter() {
    if (!keycloak?.authenticated) return;
    // Ferme aussi la session Keycloak, puis revient sur la page de connexion du portail
    await keycloak.logout({ redirectUri: `${window.location.origin}/connexion` });
  },

  async jeton() {
    if (!keycloak?.authenticated) return null;
    try {
      await keycloak.updateToken(MARGE_JETON_SECONDES);
    } catch {
      // Session Keycloak terminée : inactivité de 30 minutes, déconnexion ou compte révoqué
      keycloak.clearToken();
      surExpiration?.();
      throw new ApiError('Votre session a expiré. Reconnectez-vous.', 401, 'session_expiree');
    }
    return keycloak.token ?? null;
  },

  surExpiration(rappel) {
    surExpiration = rappel;
  },
};
