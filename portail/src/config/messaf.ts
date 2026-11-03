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
 * Rôles autorisés à entrer dans l'espace RH.
 * Seul `gestionnaire_rh` enrôle les agents : l'API réserve la création et la fiche d'enrôlement à ce rôle.
 * `admin_ministere` peut lire les agents dans l'API, mais l'espace RH ne lui est pas destiné.
 */
export const ROLES_ESPACE_RH: readonly Role[] = ['gestionnaire_rh'];
