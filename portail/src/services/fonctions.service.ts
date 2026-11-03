import { config } from '@/config/env';
import type { Absence, Fonction, NouvelleAbsence, NouvellePassation, Passation } from '@/types/fonction';
import { fonctionsApi } from './fonctions.api';
import { fonctionsDemo } from './demo/fonctions.demo';

/**
 * Fonctions, passations de service, absences et intérims (cahier des charges, chapitres 06 et 07).
 * L'API décide et tient le registre ; le bot de fonction exécute dans Matrix et rend compte.
 */
export interface FonctionsService {
  readonly simulation: boolean;
  lister(ministere: string): Promise<Fonction[]>;
  passations(ministere: string): Promise<Passation[]>;
  /** Exécutée tout de suite si la date d'effet est atteinte, sinon planifiée. */
  planifierPassation(passation: NouvellePassation): Promise<Passation>;
  relancerPassation(id: number): Promise<Passation>;
  annulerPassation(id: number): Promise<Passation>;
  absences(ministere: string): Promise<Absence[]>;
  declarerAbsence(absence: NouvelleAbsence): Promise<Absence>;
  /**
   * Supérieur hiérarchique : valider (l'intérim s'ouvre à la date prévue) ou refuser.
   * En validant, il peut désigner un autre intérimaire, même hors de la direction.
   */
  validerAbsence(id: number, decision: 'validee' | 'refusee', options?: { motif?: string; interimaire?: string }): Promise<Absence>;
  /** Retour anticipé (intérim en cours) ou annulation (absence pas encore commencée). */
  terminerAbsence(id: number): Promise<Absence>;
}

export const fonctionsService: FonctionsService = config.sourceDonnees === 'api' ? fonctionsApi : fonctionsDemo;
