import { agentsDemo as seedAgents } from '@/mocks/agents.mock';
import { postesDemo, structuresDemo } from '@/mocks/organizations.mock';
import type {
  Absence,
  CompteRenduInterim,
  Fonction,
  NouvelleAbsence,
  NouvellePassation,
  Passation,
  Personne,
  SalonFonction,
} from '@/types/fonction';
import { RANG_HABILITATION } from '@/types/messaf';
import { construireMatrixId } from '@/utils/matrix';
import type { FonctionsService } from '../fonctions.service';
import { ApiError } from '../errors';
import { sessionDemoCourante } from './auth.demo';
import { journaliserDemo } from './journal.demo';
import { ecrireStockage, latence, lireStockage } from './outils';

/**
 * SIMULATION des passations et des intérims, dans le navigateur : rien n'est envoyé au bot de
 * fonction ni à Matrix. Les comptes rendus imitent ceux du bot.
 */
const CLE_TITULAIRES = 'messaf.demo.titulaires.v1';
const CLE_PASSATIONS = 'messaf.demo.passations.v1';
const CLE_ABSENCES = 'messaf.demo.absences.v1';

const SALONS: SalonFonction[] = [
  { roomId: '!demo-drh-dh', nom: 'FCT-DRH-SANTE · DH-SANTE', poste: 'DRH-SANTE', interlocuteur: 'DH-SANTE', classification: 'diffusion_restreinte' },
  { roomId: '!demo-drh-sg', nom: 'FCT-DRH-SANTE · SG-SANTE', poste: 'DRH-SANTE', interlocuteur: 'SG-SANTE', classification: 'confidentiel' },
];

const aujourdhui = () => new Date().toISOString().slice(0, 10);

function personne(matricule: string): Personne {
  const a = seedAgents.find((x) => x.matricule === matricule);
  return { matricule, nom: a ? `${a.prenoms} ${a.nom}` : matricule, matrixId: construireMatrixId(matricule) };
}

/** Titulaires de chaque poste : jeu de données, modifié par les passations simulées. */
function titulaires(poste: string): string[] {
  const changes = lireStockage<Record<string, string[]>>(localStorage, CLE_TITULAIRES, {});
  return changes[poste] ?? seedAgents.filter((a) => a.poste === poste).map((a) => a.matricule);
}

const passations = () => lireStockage<Passation[]>(localStorage, CLE_PASSATIONS, []);
const absences = () => lireStockage<Absence[]>(localStorage, CLE_ABSENCES, []);
const salonsDe = (poste: string) => SALONS.filter((s) => s.poste === poste || s.interlocuteur === poste);

function codesDuMinistere(ministere: string): Set<string> {
  const codes = new Set([ministere]);
  for (let ajoute = true; ajoute; ) {
    ajoute = false;
    for (const s of structuresDemo) {
      if (s.parent && codes.has(s.parent) && !codes.has(s.code)) {
        codes.add(s.code);
        ajoute = true;
      }
    }
  }
  return codes;
}

/** Postes qu'un agent occupe (en général un seul). */
const postesOccupes = (matricule: string) => postesDemo.filter((x) => titulaires(x.code).includes(matricule)).map((x) => x.code);

function executer(p: Passation): Passation {
  const restants = titulaires(p.poste).filter((m) => m !== p.sortant?.matricule && m !== p.entrant.matricule);
  // Mutation : l'entrant quitte son poste actuel
  const anciens = postesOccupes(p.entrant.matricule).filter((c) => c !== p.poste);
  ecrireStockage(localStorage, CLE_TITULAIRES, {
    ...lireStockage<Record<string, string[]>>(localStorage, CLE_TITULAIRES, {}),
    ...Object.fromEntries(anciens.map((c) => [c, titulaires(c).filter((m) => m !== p.entrant.matricule)])),
    [p.poste]: [...restants, p.entrant.matricule],
  });
  const nouveaux = new Set(salonsDe(p.poste).map((s) => s.roomId));
  journaliserDemo('passation', 'succes', p.entrant.matricule, 'sante', { poste: p.poste, sortant: p.sortant?.matricule });
  return {
    ...p,
    statut: 'executee',
    executeeLe: new Date().toISOString(),
    compteRendu: {
      salons: salonsDe(p.poste).map((s) => ({
        nom: s.nom,
        entrantInvite: true,
        sortantsRetires: p.sortant ? [p.sortant.matrixId] : [],
      })),
      anciensSalons: anciens
        .flatMap(salonsDe)
        .filter((s) => !nouveaux.has(s.roomId))
        .map((s) => ({ nom: s.nom, entrantInvite: false, sortantsRetires: [p.entrant.matrixId] })),
      dossierTransmis: true,
    },
  };
}

function enregistrerPassation(p: Passation) {
  ecrireStockage(localStorage, CLE_PASSATIONS, [p, ...passations().filter((x) => x.id !== p.id)]);
  return p;
}

function enregistrerAbsence(a: Absence) {
  ecrireStockage(localStorage, CLE_ABSENCES, [a, ...absences().filter((x) => x.id !== a.id)]);
  return a;
}

function compteInterim(poste: string, fin: boolean): CompteRenduInterim {
  return {
    salons: salonsDe(poste).map((s) => ({
      nom: s.nom,
      ok: true,
      detail: fin ? '1 message reçu, 1 réponse ; intérimaire retiré' : 'intérimaire invité ; 1 affaire en cours transmise',
    })),
  };
}

/** Recalcule le droit de valider pour la session fictive en cours. */
function pourSession(a: Absence): Absence {
  const moi = sessionDemoCourante()?.matricule;
  return { ...a, peutValider: a.etat === 'en_attente' && !!moi && a.validateurs.some((v) => v.matricule === moi) };
}

export const fonctionsDemo: FonctionsService = {
  simulation: true,

  async lister(ministere) {
    await latence(200, 400);
    const codes = codesDuMinistere(ministere);
    const enCours = absences().filter((a) => a.etat === 'en_cours' && a.interimaire);
    return postesDemo
      .filter((p) => codes.has(p.structure))
      .map((p): Fonction => {
        const tit = titulaires(p.code);
        return {
          poste: p,
          titulaires: tit.map(personne),
          interimaires: enCours.filter((a) => a.poste === p.code).map((a) => ({ ...a.interimaire!, jusquAu: a.dateFin })),
          vacante: tit.length === 0,
          salons: salonsDe(p.code),
        };
      });
  },

  async passations() {
    await latence(150, 300);
    return passations();
  },

  async planifierPassation(n: NouvellePassation) {
    await latence(800, 1400);
    const poste = postesDemo.find((p) => p.code === n.poste);
    const entrant = seedAgents.find((a) => a.matricule === n.entrant);
    if (!poste) throw new ApiError('Aucun poste ne porte ce code.', 404, 'introuvable');
    if (!entrant) throw new ApiError('Les informations envoyées ont été refusées.', 422, 'donnees_invalides', { entrant: 'Aucun agent ne porte ce matricule.' });
    if (RANG_HABILITATION[entrant.habilitation] < RANG_HABILITATION[poste.habilitationRequise]) {
      throw new ApiError('Les informations envoyées ont été refusées.', 422, 'donnees_invalides', {
        entrant: `Habilitation insuffisante : le poste exige « ${poste.habilitationRequise} ».`,
      });
    }
    const tit = titulaires(n.poste);
    if (tit.includes(n.entrant)) throw new ApiError('Cet agent occupe déjà ce poste.', 409, 'deja_titulaire');
    const sortant = n.sortant ?? tit[0];
    const p: Passation = {
      id: Date.now(),
      poste: n.poste,
      intitule: poste.intitule,
      sortant: sortant ? personne(sortant) : undefined,
      entrant: personne(n.entrant),
      dateEffet: n.dateEffet,
      motif: n.motif,
      statut: 'planifiee',
      demandeeLe: new Date().toISOString(),
    };
    journaliserDemo('passation_planifiee', 'succes', n.entrant, 'sante', { poste: n.poste, date_effet: n.dateEffet });
    return enregistrerPassation(n.dateEffet <= aujourdhui() ? executer(p) : p);
  },

  async relancerPassation(id) {
    await latence(600, 1000);
    const p = passations().find((x) => x.id === id);
    if (!p) throw new ApiError('Aucune passation ne porte ce numéro.', 404, 'introuvable');
    if (p.dateEffet > aujourdhui()) throw new ApiError('Cette passation prendra effet plus tard.', 409, 'passation_future');
    return enregistrerPassation(executer(p));
  },

  async annulerPassation(id) {
    await latence();
    const p = passations().find((x) => x.id === id);
    if (!p || p.statut !== 'planifiee') throw new ApiError('Cette passation ne peut plus être annulée.', 409, 'passation_terminee');
    return enregistrerPassation({ ...p, statut: 'annulee' });
  },

  async absences(ministere) {
    await latence(200, 400);
    const codes = codesDuMinistere(ministere);
    const postes = new Set(postesDemo.filter((p) => codes.has(p.structure)).map((p) => p.code));
    return absences().filter((a) => postes.has(a.poste)).map(pourSession);
  },

  async declarerAbsence(n: NouvelleAbsence) {
    await latence(500, 900);
    const agent = seedAgents.find((a) => a.matricule === n.matricule);
    if (!agent) throw new ApiError('Aucun agent ne porte ce matricule.', 404, 'introuvable');
    const poste = postesDemo.find((p) => p.code === agent.poste)!;
    const interimaire = n.interimaire ? seedAgents.find((a) => a.matricule === n.interimaire) : undefined;
    if (interimaire && interimaire.direction !== agent.direction) {
      throw new ApiError('Les informations envoyées ont été refusées.', 422, 'donnees_invalides', {
        interimaire: "L'intérimaire doit appartenir à la même direction (ou être désigné par le supérieur).",
      });
    }
    if (interimaire && RANG_HABILITATION[interimaire.habilitation] < RANG_HABILITATION[poste.habilitationRequise]) {
      throw new ApiError('Les informations envoyées ont été refusées.', 422, 'donnees_invalides', {
        interimaire: `Habilitation insuffisante : le poste exige « ${poste.habilitationRequise} ».`,
      });
    }
    const a: Absence = {
      id: Date.now(),
      agent: personne(agent.matricule),
      poste: poste.code,
      intitule: poste.intitule,
      statut: n.statut,
      precision: n.precision,
      dateDebut: n.dateDebut,
      dateFin: n.dateFin,
      interimaire: interimaire ? personne(interimaire.matricule) : undefined,
      etat: 'en_attente',
      declareeLe: new Date().toISOString(),
      validateurs: poste.posteSuperieur ? titulaires(poste.posteSuperieur).map(personne) : [],
      peutValider: false,
    };
    journaliserDemo('absence', 'succes', agent.matricule, 'sante', { poste: poste.code, interimaire: n.interimaire });
    return pourSession(enregistrerAbsence(a));
  },

  async validerAbsence(id, decision, { motif, interimaire } = {}) {
    await latence(700, 1200);
    const a = absences().find((x) => x.id === id);
    if (!a || a.etat !== 'en_attente') throw new ApiError('Cette demande a déjà été traitée.', 409, 'absence_traitee');
    const moi = sessionDemoCourante()?.matricule;
    if (!moi || !a.validateurs.some((v) => v.matricule === moi)) {
      throw new ApiError("Seul le supérieur hiérarchique de l'agent peut valider cet intérim.", 403, 'interdit');
    }
    const designe = decision === 'validee' && interimaire && interimaire !== a.interimaire?.matricule;
    if (designe && !seedAgents.some((x) => x.matricule === interimaire && x.matricule !== a.agent.matricule)) {
      throw new ApiError('Les informations envoyées ont été refusées.', 422, 'donnees_invalides', {
        interimaire: 'Aucun agent actif ne porte ce matricule.',
      });
    }
    journaliserDemo('absence_validation', 'succes', a.agent.matricule, 'sante', { decision, motif, interimaire: designe ? interimaire : undefined });
    let suite: Absence = {
      ...a,
      etat: decision,
      interimaire: designe ? personne(interimaire) : a.interimaire,
      valideePar: personne(moi),
      motifRefus: decision === 'refusee' ? motif : undefined,
    };
    if (decision === 'validee' && a.dateDebut <= aujourdhui()) {
      suite = { ...suite, etat: 'en_cours', debut: a.interimaire ? compteInterim(a.poste, false) : undefined };
      journaliserDemo('interim_debut', 'succes', a.interimaire?.matricule ?? a.agent.matricule, 'sante', { poste: a.poste });
    }
    return pourSession(enregistrerAbsence(suite));
  },

  async terminerAbsence(id) {
    await latence(700, 1200);
    const a = absences().find((x) => x.id === id);
    if (!a) throw new ApiError('Aucune absence ne porte ce numéro.', 404, 'introuvable');
    if (a.etat === 'en_cours') {
      journaliserDemo('interim_fin', 'succes', a.interimaire?.matricule ?? a.agent.matricule, 'sante', { poste: a.poste, anticipee: true });
      return pourSession(enregistrerAbsence({ ...a, etat: 'terminee', dateFin: aujourdhui(), fin: a.interimaire ? compteInterim(a.poste, true) : undefined }));
    }
    if (a.etat === 'en_attente' || a.etat === 'validee') return pourSession(enregistrerAbsence({ ...a, etat: 'annulee' }));
    throw new ApiError('Cette absence est déjà terminée.', 409, 'absence_terminee');
  },
};
