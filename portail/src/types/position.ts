import type { Habilitation } from './messaf';

/** Poste : la fonction dans l'organisation (ex. DRH-SANTE). Stocké dans la base de l'API. */
export interface Poste {
  code: string;
  intitule: string;
  /** Code de la structure de rattachement. */
  structure: string;
  /** Code du poste supérieur, s'il existe. */
  posteSuperieur?: string;
  habilitationRequise: Habilitation;
}
