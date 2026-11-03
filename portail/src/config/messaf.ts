import type { Role } from '@/types/messaf';

/** Domaine Matrix fixé au premier démarrage de Synapse : il ne peut plus changer. */
export const DOMAINE_MATRIX = 'gov.bf';

/**
 * Format de matricule accepté par le formulaire.
 * 6 chiffres, comme dans l'API (identite.matricule) et le jeu de données fictif (100001 à 100011).
 * L'API reste seule juge.
 */
export const FORMAT_MATRICULE = /^\d{6}$/;
export const DESCRIPTION_FORMAT_MATRICULE = '6 chiffres, par exemple 100012';

/**
 * Rôles par espace du portail, alignés sur l'API d'administration (api/README.md).
 * `super_admin` a tous les droits, comme dans l'API. Ces listes ne règlent que l'affichage :
 * l'API vérifie le rôle et le ministère à chaque appel.
 */
/** Enrôlement : création des agents et fiche d'enrôlement. */
export const ROLES_ENROLEMENT: readonly Role[] = ['gestionnaire_rh', 'super_admin'];
/** Consultation des agents du ministère (liste et fiche détaillée). */
export const ROLES_CONSULTATION: readonly Role[] = ['gestionnaire_rh', 'admin_ministere', 'super_admin'];
/** Révocation et réactivation des accès. */
export const ROLES_REVOCATION: readonly Role[] = ['admin_ministere', 'super_admin'];
/** Lecture du journal d'audit. */
export const ROLES_AUDIT: readonly Role[] = ['auditeur', 'super_admin'];
/** Tout rôle qui ouvre au moins un espace du portail. */
export const ROLES_PORTAIL: readonly Role[] = ['gestionnaire_rh', 'admin_ministere', 'auditeur', 'super_admin'];
