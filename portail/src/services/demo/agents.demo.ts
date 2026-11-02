import { agentsDemo as seedAgents, type AgentDemo } from '@/mocks/agents.mock';
import { postesDemo, structuresDemo } from '@/mocks/organizations.mock';
import type { Agent } from '@/types/agent';
import type { VisibiliteAnnuaire } from '@/types/profile';
import { construireMatrixId } from '@/utils/matrix';
import type { AgentsService } from '../agents.service';
import { ApiError } from '../errors';
import { genererFicheDemo } from './fiche.demo';
import { effacerStockage, ecrireStockage, latence, lireStockage } from './outils';

/**
 * SIMULATION de l'API d'administration, entièrement dans le navigateur.
 * Rien n'est créé dans Keycloak, Synapse ou PostgreSQL.
 * Les agents créés pendant les essais sont gardés dans le localStorage (données fictives,
 * aucun mot de passe ni code d'activation).
 */

const CLE_STOCKAGE = 'messaf.demo.agents-crees.v1';

/** Matricules qui déclenchent une erreur serveur simulée, pour tester l'affichage des erreurs. */
const PREFIXE_ERREUR_SIMULEE = '999';

interface AgentDemoStocke extends AgentDemo {
  dateFin?: string;
  annuaire?: VisibiliteAnnuaire;
}

const agentsCrees = (): AgentDemoStocke[] => lireStockage<AgentDemoStocke[]>(localStorage, CLE_STOCKAGE, []);

const tousLesAgents = (): AgentDemoStocke[] => [...seedAgents, ...agentsCrees()];

function versAgent(a: AgentDemoStocke): Agent {
  return {
    identite: {
      matricule: a.matricule,
      nom: a.nom,
      prenoms: a.prenoms,
      coordonnees: { email: a.email, telephone: a.telephone },
    },
    profil: {
      ministere: a.ministere,
      direction: a.direction,
      service: a.service,
      annuaire: a.annuaire ?? { afficherEmail: true, afficherTelephone: !!a.telephone },
    },
    habilitation: a.habilitation,
    etat: 'actif',
    matrixId: construireMatrixId(a.matricule),
    affectation: { matricule: a.matricule, poste: a.poste, dateDebut: a.dateDebut, dateFin: a.dateFin },
    poste: postesDemo.find((p) => p.code === a.poste),
    creeLe: a.creeLe,
  };
}

function structure(code: string) {
  return structuresDemo.find((s) => s.code === code);
}

export const agentsDemo: AgentsService = {
  simulation: true,

  async lister({ ministere }) {
    await latence();
    return tousLesAgents()
      .filter((a) => a.ministere === ministere)
      .map(versAgent)
      .sort((x, y) => (y.creeLe ?? '').localeCompare(x.creeLe ?? ''));
  },

  async obtenir(matricule, { ministere }) {
    await latence(200, 500);
    const trouve = tousLesAgents().find((a) => a.matricule === matricule);
    // Comme le ferait le serveur : un agent hors périmètre est traité comme introuvable.
    if (!trouve || trouve.ministere !== ministere) throw new ApiError('Agent introuvable dans votre périmètre.', 404);
    return versAgent(trouve);
  },

  async matriculeDisponible(matricule) {
    await latence(150, 300);
    return !tousLesAgents().some((a) => a.matricule === matricule);
  },

  async creer(nouvel) {
    await latence(700, 1300);
    const { identite, profil, affectation, habilitation } = nouvel;

    if (identite.matricule.startsWith(PREFIXE_ERREUR_SIMULEE)) {
      throw new ApiError(
        `Erreur serveur simulée (matricule commençant par ${PREFIXE_ERREUR_SIMULEE}) : aucune donnée n'a été enregistrée.`,
        500,
      );
    }
    if (tousLesAgents().some((a) => a.matricule === identite.matricule)) {
      throw new ApiError('Ce matricule est déjà utilisé par un agent enregistré.', 409, 'matricule_existant', {
        matricule: 'Ce matricule est déjà utilisé.',
      });
    }
    const dir = structure(profil.direction);
    const svc = structure(profil.service);
    const poste = postesDemo.find((p) => p.code === affectation.poste);
    if (dir?.parent !== profil.ministere || svc?.parent !== profil.direction || !poste) {
      throw new ApiError('Le profil ou le poste ne correspond pas à l’organigramme du ministère.', 422);
    }

    const stocke: AgentDemoStocke = {
      matricule: identite.matricule,
      nom: identite.nom,
      prenoms: identite.prenoms,
      email: identite.coordonnees.email,
      telephone: identite.coordonnees.telephone || undefined,
      ministere: profil.ministere,
      direction: profil.direction,
      service: profil.service,
      annuaire: profil.annuaire,
      poste: affectation.poste,
      dateDebut: affectation.dateDebut,
      dateFin: affectation.dateFin || undefined,
      habilitation,
      creeLe: new Date().toISOString(),
    };
    ecrireStockage(localStorage, CLE_STOCKAGE, [...agentsCrees(), stocke]);
    return { agent: versAgent(stocke), simulee: true };
  },

  async ficheEnrolement(matricule) {
    await latence(500, 900);
    const trouve = tousLesAgents().find((a) => a.matricule === matricule);
    if (!trouve) throw new ApiError('Agent introuvable.', 404);
    return genererFicheDemo(versAgent(trouve));
  },

  reinitialiserDemonstration() {
    effacerStockage(localStorage, CLE_STOCKAGE);
  },
};
