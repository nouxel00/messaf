import { routesApi } from '@/config/api';
import type { Agent, EtatEnrolement, NouvelAgent } from '@/types/agent';
import type { EtatCompte, Habilitation } from '@/types/messaf';
import { construireMatrixId } from '@/utils/matrix';
import { api } from './api';
import type { AgentsService } from './agents.service';
import { ApiError } from './errors';
import { versPoste, type PosteApi } from './referentiel.api';

/**
 * Implémentation réelle, par l'API d'administration (api/openapi.yaml) :
 *   GET  /agents?ministere=…                  → lister()
 *   GET  /agents/{matricule}                  → obtenir(), matriculeDisponible()
 *   POST /agents                              → creer()
 *   GET  /agents/{matricule}/fiche-enrolement → ficheEnrolement()
 * Le jeton Keycloak est joint par services/api.ts ; l'API vérifie le rôle et le ministère.
 */

// --- Corps JSON de l'API (snake_case) ---

interface CreerAgentRequete {
  identite: {
    matricule: string;
    nom: string;
    prenoms: string;
    email: string;
    telephone?: string;
  };
  profil: {
    ministere: string;
    direction: string;
    service: string;
    annuaire: { email: boolean; telephone: boolean };
  };
  habilitation: Habilitation;
  affectation: {
    poste: string;
    date_debut: string;
    date_fin: string | null;
  };
}

interface CreerAgentReponse {
  matricule: string;
  matrix_id: string;
  etat: EtatCompte;
  enrolement: EtatEnrolement;
  cree_le: string;
}

/** Un agent, tel que GET /agents et GET /agents/{matricule} le renvoient. */
interface AgentApi {
  identite: { matricule: string; nom: string; prenoms: string; email: string | null; telephone: string | null };
  profil: {
    ministere: string;
    direction: string;
    service: string;
    annuaire: { email: boolean; telephone: boolean };
  };
  habilitation: Habilitation;
  etat: EtatCompte;
  matrix_id: string;
  enrolement: EtatEnrolement;
  affectation: { poste: string; date_debut: string; date_fin: string | null } | null;
  poste: PosteApi | null;
  cree_le: string | null;
}

function versRequete(agent: NouvelAgent): CreerAgentRequete {
  const { identite, profil, affectation, habilitation } = agent;
  return {
    identite: {
      matricule: identite.matricule,
      nom: identite.nom,
      prenoms: identite.prenoms,
      email: identite.coordonnees.email,
      telephone: identite.coordonnees.telephone || undefined,
    },
    profil: {
      ministere: profil.ministere,
      direction: profil.direction,
      service: profil.service,
      annuaire: { email: profil.annuaire.afficherEmail, telephone: profil.annuaire.afficherTelephone },
    },
    habilitation,
    affectation: {
      poste: affectation.poste,
      date_debut: affectation.dateDebut,
      date_fin: affectation.dateFin || null,
    },
  };
}

function versAgent(a: AgentApi): Agent {
  const matricule = a.identite.matricule;
  return {
    identite: {
      matricule,
      nom: a.identite.nom,
      prenoms: a.identite.prenoms,
      coordonnees: { email: a.identite.email ?? '', telephone: a.identite.telephone ?? undefined },
    },
    profil: {
      ministere: a.profil.ministere,
      direction: a.profil.direction,
      service: a.profil.service,
      annuaire: { afficherEmail: a.profil.annuaire.email, afficherTelephone: a.profil.annuaire.telephone },
    },
    habilitation: a.habilitation,
    etat: a.etat,
    enrolement: a.enrolement,
    matrixId: a.matrix_id,
    affectation: a.affectation
      ? {
          matricule,
          poste: a.affectation.poste,
          dateDebut: a.affectation.date_debut,
          dateFin: a.affectation.date_fin ?? undefined,
        }
      : undefined,
    poste: a.poste ? versPoste(a.poste) : undefined,
    creeLe: a.cree_le ?? undefined,
  };
}

export const agentsApi: AgentsService = {
  simulation: false,

  async lister({ ministere }) {
    const agents = await api.json<AgentApi[]>(routesApi.agents(ministere));
    // Les plus récents d'abord, comme en démonstration (tableau de bord : derniers ajouts)
    return agents.map(versAgent).sort((x, y) => (y.creeLe ?? '').localeCompare(x.creeLe ?? ''));
  },

  async obtenir(matricule) {
    return versAgent(await api.json<AgentApi>(routesApi.agent(matricule)));
  },

  /**
   * Vérification anticipée du matricule. Les matricules sont uniques dans toute l'administration :
   * un agent d'un autre ministère (403, hors périmètre) occupe aussi le matricule.
   * Le serveur reste seul juge à la création (409 `matricule_existant`).
   */
  async matriculeDisponible(matricule) {
    try {
      await api.json<AgentApi>(routesApi.agent(matricule));
      return false;
    } catch (erreur) {
      if (erreur instanceof ApiError && erreur.status === 404) return true;
      if (erreur instanceof ApiError && erreur.status === 403 && erreur.code === 'interdit') return false;
      throw erreur;
    }
  },

  async creer(nouvel) {
    const reponse = await api.json<CreerAgentReponse>(routesApi.agents(), {
      method: 'POST',
      corps: versRequete(nouvel),
    });
    const agent: Agent = {
      identite: nouvel.identite,
      profil: nouvel.profil,
      habilitation: nouvel.habilitation,
      etat: reponse.etat,
      enrolement: reponse.enrolement,
      matrixId: reponse.matrix_id ?? construireMatrixId(reponse.matricule),
      affectation: { matricule: reponse.matricule, ...nouvel.affectation },
      creeLe: reponse.cree_le,
    };
    return { agent, simulee: false };
  },

  ficheEnrolement(matricule) {
    return api.blob(routesApi.ficheEnrolement(matricule), { accept: 'application/pdf' });
  },
};
