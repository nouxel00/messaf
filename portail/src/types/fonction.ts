import type { Poste } from './position';

/**
 * Fonctions, passations de service et intérims (cahier des charges, chapitres 06 et 07).
 * Une fonction n'est pas un compte : c'est un ensemble de salons géré par le bot de fonction,
 * dont le titulaire actuel est membre.
 */
export interface Personne {
  matricule: string;
  nom: string;
  matrixId: string;
}

export interface SalonFonction {
  roomId: string;
  /** Nom neutre, ex. FCT-DRH-SANTE · DH-SANTE */
  nom: string;
  poste: string;
  interlocuteur: string;
}

export interface Fonction {
  poste: Poste;
  titulaires: Personne[];
  interimaires: (Personne & { jusquAu: string })[];
  vacante: boolean;
  salons: SalonFonction[];
}

export type StatutPassation = 'planifiee' | 'executee' | 'echec' | 'annulee';

/** Compte rendu du bot, salon par salon. */
export interface SalonPasse {
  nom: string;
  entrantInvite: boolean;
  sortantsRetires: string[];
  erreur?: string;
}

export interface CompteRenduPassation {
  salons: SalonPasse[];
  /** Mutation : salons de l'ancienne fonction de l'entrant, dont il a été retiré. */
  anciensSalons: SalonPasse[];
  /** Salon où le dossier de passation a été remis à l'entrant. */
  dossierTransmis: boolean;
  erreur?: string;
}

export interface Passation {
  id: number;
  poste: string;
  intitule: string;
  sortant?: Personne;
  entrant: Personne;
  dateEffet: string;
  motif?: string;
  statut: StatutPassation;
  demandeeLe: string;
  executeeLe?: string;
  compteRendu?: CompteRenduPassation;
}

export interface NouvellePassation {
  poste: string;
  entrant: string;
  sortant?: string;
  dateEffet: string;
  motif?: string;
}

export const LIBELLES_STATUT_PASSATION: Record<StatutPassation, string> = {
  planifiee: 'Planifiée',
  executee: 'Exécutée',
  echec: 'En échec',
  annulee: 'Annulée',
};

// ----- Absences et intérims -----

export const STATUTS_ABSENCE = ['en_mission', 'en_conge', 'absent'] as const;
export type StatutAbsence = (typeof STATUTS_ABSENCE)[number];

export const LIBELLES_STATUT_ABSENCE: Record<StatutAbsence, string> = {
  en_mission: 'En mission',
  en_conge: 'En congé',
  absent: 'Absent (maladie, formation)',
};

export type EtatAbsence = 'en_attente' | 'validee' | 'refusee' | 'en_cours' | 'terminee' | 'annulee';

export const LIBELLES_ETAT_ABSENCE: Record<EtatAbsence, string> = {
  en_attente: 'À valider',
  validee: 'Validée',
  refusee: 'Refusée',
  en_cours: 'Intérim en cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
};

export interface CompteRenduInterim {
  salons: { nom: string; ok: boolean; detail: string; erreur?: string }[];
  erreur?: string;
}

export interface Absence {
  id: number;
  agent: Personne;
  poste: string;
  intitule: string;
  statut: StatutAbsence;
  precision?: string;
  dateDebut: string;
  dateFin: string;
  interimaire?: Personne;
  etat: EtatAbsence;
  declareeLe: string;
  validateurs: Personne[];
  valideePar?: Personne;
  motifRefus?: string;
  /** Vrai si l'utilisateur connecté peut valider cette demande. */
  peutValider: boolean;
  debut?: CompteRenduInterim;
  fin?: CompteRenduInterim;
}

export interface NouvelleAbsence {
  matricule: string;
  statut: StatutAbsence;
  precision?: string;
  dateDebut: string;
  dateFin: string;
  interimaire?: string;
}
