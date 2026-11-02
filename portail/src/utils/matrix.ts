import { DOMAINE_MATRIX, FORMAT_MATRICULE } from '@/config/messaf';

export function matriculeValide(matricule: string): boolean {
  return FORMAT_MATRICULE.test(matricule.trim());
}

/**
 * Construit l'identifiant Matrix d'un agent selon la convention MESSAF : @m<matricule>:gov.bf.
 * La lettre m est obligatoire (Synapse refuse les identifiants uniquement numériques)
 * et l'identifiant est en minuscules.
 */
export function construireMatrixId(matricule: string): string {
  return `@m${matricule.trim().toLowerCase()}:${DOMAINE_MATRIX}`;
}

/** Aperçu affiché pendant la saisie : null tant que le matricule n'est pas valide. */
export function apercuMatrixId(matricule: string): string | null {
  return matriculeValide(matricule) ? construireMatrixId(matricule) : null;
}
