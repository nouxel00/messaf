import { config } from '@/config/env';
import type { Poste } from '@/types/position';
import type { Structure } from '@/types/structure';
import { referentielApi } from './referentiel.api';
import { referentielDemo } from './demo/referentiel.demo';

/**
 * Données organisationnelles (organigramme et postes) nécessaires au formulaire.
 * En lecture seule : la gestion des structures et des postes est hors périmètre.
 */
export interface ReferentielService {
  /** Le ministère et toutes ses directions et services. */
  structuresDuMinistere(ministere: string): Promise<Structure[]>;
  /** Les postes rattachés aux structures du ministère. */
  postesDuMinistere(ministere: string): Promise<Poste[]>;
}

export const referentielService: ReferentielService =
  config.sourceDonnees === 'api' ? referentielApi : referentielDemo;
