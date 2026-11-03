import { routesApi } from '@/config/api';
import type {
  Absence,
  CompteRenduInterim,
  CompteRenduPassation,
  EtatAbsence,
  Passation,
  Personne,
  StatutAbsence,
  StatutPassation,
} from '@/types/fonction';
import { api } from './api';
import type { FonctionsService } from './fonctions.service';
import { versPoste, type PosteApi } from './referentiel.api';

/** Corps renvoyés par l'API (snake_case), voir api/openapi.yaml. */
interface PersonneApi {
  matricule: string;
  nom: string;
  matrix_id: string;
}
interface FonctionApi {
  poste: PosteApi;
  titulaires: PersonneApi[];
  interimaires: (PersonneApi & { jusqu_au: string })[];
  vacante: boolean;
  salons: { room_id: string; nom: string; poste: string; interlocuteur: string }[];
}
interface PassationApi {
  id: number;
  poste: string;
  intitule: string;
  sortant: PersonneApi | null;
  entrant: PersonneApi;
  date_effet: string;
  motif: string | null;
  statut: StatutPassation;
  demandee_le: string;
  executee_le: string | null;
  compte_rendu: {
    salons?: SalonPasseApi[];
    anciens_salons?: SalonPasseApi[];
    dossier?: string | null;
    erreur?: string;
  } | null;
}
interface SalonInterimApi {
  nom: string;
  interimaire_invite?: boolean;
  affaires_en_cours?: number;
  interimaire_retire?: boolean;
  messages_recus?: number;
  reponses?: number;
  erreur: string | null;
}
interface AbsenceApi {
  id: number;
  agent: PersonneApi;
  poste: string;
  intitule: string;
  statut: StatutAbsence;
  precision: string | null;
  date_debut: string;
  date_fin: string;
  interimaire: PersonneApi | null;
  etat: EtatAbsence;
  declaree_le: string;
  validateurs: PersonneApi[];
  validee_par: PersonneApi | null;
  motif_refus: string | null;
  peut_valider: boolean;
  compte_rendu: {
    debut?: { salons?: SalonInterimApi[]; erreur?: string };
    fin?: { salons?: SalonInterimApi[]; erreur?: string; compte_rendu?: string | null };
  } | null;
}

const personne = (p: PersonneApi): Personne => ({ matricule: p.matricule, nom: p.nom, matrixId: p.matrix_id });

interface SalonPasseApi {
  nom: string;
  entrant_invite: boolean;
  sortants_retires: string[];
  erreur: string | null;
}

const versSalonPasse = (s: SalonPasseApi) => ({
  nom: s.nom,
  entrantInvite: s.entrant_invite,
  sortantsRetires: s.sortants_retires,
  erreur: s.erreur ?? undefined,
});

function versPassation(p: PassationApi): Passation {
  const cr = p.compte_rendu;
  const compteRendu: CompteRenduPassation | undefined = cr
    ? {
        salons: (cr.salons ?? []).map(versSalonPasse),
        anciensSalons: (cr.anciens_salons ?? []).map(versSalonPasse),
        dossierTransmis: !!cr.dossier,
        erreur: cr.erreur,
      }
    : undefined;
  return {
    id: p.id,
    poste: p.poste,
    intitule: p.intitule,
    sortant: p.sortant ? personne(p.sortant) : undefined,
    entrant: personne(p.entrant),
    dateEffet: p.date_effet,
    motif: p.motif ?? undefined,
    statut: p.statut,
    demandeeLe: p.demandee_le,
    executeeLe: p.executee_le ?? undefined,
    compteRendu,
  };
}

function versCompteInterim(c: { salons?: SalonInterimApi[]; erreur?: string } | undefined, fin: boolean) {
  if (!c) return undefined;
  const r: CompteRenduInterim = {
    erreur: c.erreur,
    salons: (c.salons ?? []).map((s) => ({
      nom: s.nom,
      ok: !s.erreur,
      erreur: s.erreur ?? undefined,
      detail: fin
        ? `${s.messages_recus ?? 0} message(s) reçu(s), ${s.reponses ?? 0} réponse(s) ; intérimaire ${s.interimaire_retire ? 'retiré' : 'non retiré'}`
        : `intérimaire ${s.interimaire_invite ? 'invité' : 'non invité'} ; ${s.affaires_en_cours ?? 0} affaire(s) en cours transmise(s)`,
    })),
  };
  return r;
}

function versAbsence(a: AbsenceApi): Absence {
  return {
    id: a.id,
    agent: personne(a.agent),
    poste: a.poste,
    intitule: a.intitule,
    statut: a.statut,
    precision: a.precision ?? undefined,
    dateDebut: a.date_debut,
    dateFin: a.date_fin,
    interimaire: a.interimaire ? personne(a.interimaire) : undefined,
    etat: a.etat,
    declareeLe: a.declaree_le,
    validateurs: a.validateurs.map(personne),
    valideePar: a.validee_par ? personne(a.validee_par) : undefined,
    motifRefus: a.motif_refus ?? undefined,
    peutValider: a.peut_valider,
    debut: versCompteInterim(a.compte_rendu?.debut, false),
    fin: versCompteInterim(a.compte_rendu?.fin, true),
  };
}

export const fonctionsApi: FonctionsService = {
  simulation: false,

  async lister(ministere) {
    const fonctions = await api.json<FonctionApi[]>(routesApi.fonctions(ministere));
    return fonctions.map((f) => ({
      poste: versPoste(f.poste),
      titulaires: f.titulaires.map(personne),
      interimaires: f.interimaires.map((i) => ({ ...personne(i), jusquAu: i.jusqu_au })),
      vacante: f.vacante,
      salons: f.salons.map((s) => ({ roomId: s.room_id, nom: s.nom, poste: s.poste, interlocuteur: s.interlocuteur })),
    }));
  },

  async passations(ministere) {
    return (await api.json<PassationApi[]>(routesApi.passations(ministere))).map(versPassation);
  },

  async planifierPassation(p) {
    const corps = { poste: p.poste, entrant: p.entrant, sortant: p.sortant, date_effet: p.dateEffet, motif: p.motif || undefined };
    return versPassation(await api.json<PassationApi>(routesApi.passations(), { method: 'POST', corps }));
  },

  async relancerPassation(id) {
    return versPassation(await api.json<PassationApi>(routesApi.executionPassation(id), { method: 'POST' }));
  },

  async annulerPassation(id) {
    return versPassation(await api.json<PassationApi>(routesApi.annulationPassation(id), { method: 'POST' }));
  },

  async absences(ministere) {
    return (await api.json<AbsenceApi[]>(routesApi.absences(ministere))).map(versAbsence);
  },

  async declarerAbsence(a) {
    const corps = {
      matricule: a.matricule,
      statut: a.statut,
      precision: a.precision || undefined,
      date_debut: a.dateDebut,
      date_fin: a.dateFin,
      interimaire: a.interimaire || undefined,
    };
    return versAbsence(await api.json<AbsenceApi>(routesApi.absences(), { method: 'POST', corps }));
  },

  async validerAbsence(id, decision, options = {}) {
    const corps = { decision, motif: options.motif || undefined, interimaire: options.interimaire || undefined };
    return versAbsence(await api.json<AbsenceApi>(routesApi.validationAbsence(id), { method: 'POST', corps }));
  },

  async terminerAbsence(id) {
    return versAbsence(await api.json<AbsenceApi>(routesApi.finAbsence(id), { method: 'POST' }));
  },
};
