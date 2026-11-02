/**
 * Conventions communes MESSAF (document de démarrage, section 5).
 * Ces valeurs sont partagées avec Keycloak et l'API d'administration : ne pas les modifier
 * sans décision commune avec Axel.
 */

export const ROLES = [
  'super_admin',
  'admin_ministere',
  'gestionnaire_rh',
  'superieur',
  'auditeur',
  'archiviste',
] as const;
export type Role = (typeof ROLES)[number];

export const HABILITATIONS = ['normal', 'diffusion_restreinte', 'confidentiel'] as const;
export type Habilitation = (typeof HABILITATIONS)[number];

export const ETATS_COMPTE = ['actif', 'suspendu', 'revoque'] as const;
export type EtatCompte = (typeof ETATS_COMPTE)[number];

export const LIBELLES_ROLE: Record<Role, string> = {
  super_admin: 'Super-administrateur',
  admin_ministere: 'Administrateur ministériel',
  gestionnaire_rh: 'Gestionnaire RH',
  superieur: 'Supérieur hiérarchique',
  auditeur: 'Auditeur',
  archiviste: 'Archiviste',
};

export const LIBELLES_HABILITATION: Record<Habilitation, string> = {
  normal: 'Normal',
  diffusion_restreinte: 'Diffusion restreinte',
  confidentiel: 'Confidentiel',
};

export const DESCRIPTIONS_HABILITATION: Record<Habilitation, string> = {
  normal: 'Échanges professionnels courants, sans classification particulière.',
  diffusion_restreinte:
    'Accès aux messages dont la diffusion est limitée aux agents habilités de ce niveau.',
  confidentiel:
    'Niveau le plus élevé du prototype : accès aux messages classés Confidentiel.',
};

/** Ordre des niveaux, du moins au plus sensible. */
export const RANG_HABILITATION: Record<Habilitation, number> = {
  normal: 0,
  diffusion_restreinte: 1,
  confidentiel: 2,
};

export const LIBELLES_ETAT: Record<EtatCompte, string> = {
  actif: 'Actif',
  suspendu: 'Suspendu',
  revoque: 'Révoqué',
};
