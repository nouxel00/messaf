import { config } from '@/config/env';
import type { IdentifiantsConnexion, ModeAuthentification, SessionUtilisateur } from '@/types/auth';
import { authKeycloak } from './auth.keycloak';
import { authDemo } from './demo/auth.demo';

/**
 * Contrat commun aux deux modes d'authentification. Le portail ne gère jamais de mots de passe
 * lui-même : en production, Keycloak authentifie l'utilisateur et délivre le jeton.
 */
export interface AuthService {
  readonly mode: ModeAuthentification;
  /** Reprend une session existante au chargement de la page. */
  restaurer(): Promise<SessionUtilisateur | null>;
  /**
   * Démonstration : vérifie un accès fictif.
   * Keycloak : redirige vers la page de connexion de Keycloak (les identifiants n'y transitent pas).
   */
  connecter(identifiants?: IdentifiantsConnexion): Promise<SessionUtilisateur>;
  deconnecter(): Promise<void>;
  /** Jeton d'accès à joindre aux appels de l'API (null en démonstration). */
  jeton(): Promise<string | null>;
  /** Keycloak : prévient quand la session a pris fin (le portail revient alors à la connexion). */
  surExpiration?(rappel: () => void): void;
}

export const authService: AuthService = config.modeAuth === 'keycloak' ? authKeycloak : authDemo;
