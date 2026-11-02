import type { Role } from './messaf';

export type ModeAuthentification = 'demo' | 'keycloak';

/** Utilisateur connecté au portail. Aucun mot de passe n'est conservé. */
export interface SessionUtilisateur {
  identifiant: string;
  nomComplet: string;
  matricule?: string;
  roles: Role[];
  /** Ministère de rattachement : périmètre administratif de l'utilisateur. */
  ministere: string;
  /** Intitulé du poste occupé, pour l'affichage. */
  poste?: string;
  /** Date d'ouverture de la session (ISO 8601). */
  ouverteLe: string;
  source: ModeAuthentification;
}

export interface IdentifiantsConnexion {
  identifiant: string;
  motDePasse: string;
}
