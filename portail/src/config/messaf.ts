import type { Role } from '@/types/messaf';

/** Domaine Matrix fixé au premier démarrage de Synapse : il ne peut plus changer. */
export const DOMAINE_MATRIX = 'gov.bf';

/**
 * Format de matricule accepté par le formulaire.
 * HYPOTHÈSE PROVISOIRE : 6 chiffres, comme le jeu de données fictif (100001 à 100011).
 * Le format officiel est à confirmer avec Axel ; l'API reste seule juge.
 */
export const FORMAT_MATRICULE = /^\d{6}$/;
export const DESCRIPTION_FORMAT_MATRICULE = '6 chiffres, par exemple 100012';

/**
 * Rôles autorisés à entrer dans l'espace RH.
 * HYPOTHÈSE PROVISOIRE : seul `gestionnaire_rh` enrôle les agents (jeu de données, section 10).
 * À confirmer avec Axel si `admin_ministere` doit aussi y accéder.
 */
export const ROLES_ESPACE_RH: readonly Role[] = ['gestionnaire_rh'];
