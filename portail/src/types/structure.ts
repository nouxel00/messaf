/** Organigramme (ministères, directions, services). Stocké dans la base de l'API. */
export type TypeStructure = 'ministere' | 'direction' | 'service';

export interface Structure {
  code: string;
  libelle: string;
  sigle?: string;
  type: TypeStructure;
  /** Code de la structure parente (absent pour un ministère). */
  parent?: string;
}
