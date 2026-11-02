import { config } from '@/config/env';
import type { Agent, FiltreAgents, NouvelAgent, ResultatCreationAgent } from '@/types/agent';
import { agentsApi } from './agents.api';
import { agentsDemo } from './demo/agents.demo';

/**
 * Point d'accès unique des pages aux agents. Le choix entre simulation et API se fait ici,
 * par la variable VITE_DATA_SOURCE : les composants n'en savent rien.
 */
export interface AgentsService {
  /** Vrai quand les réponses sont simulées par le navigateur. */
  readonly simulation: boolean;
  lister(filtre: FiltreAgents): Promise<Agent[]>;
  obtenir(matricule: string, filtre: FiltreAgents): Promise<Agent>;
  /**
   * Vérification anticipée d'un doublon de matricule.
   * `null` = vérification impossible avant l'envoi : le serveur tranchera à la création.
   */
  matriculeDisponible(matricule: string): Promise<boolean | null>;
  creer(agent: NouvelAgent): Promise<ResultatCreationAgent>;
  /** Fiche d'enrôlement au format PDF. */
  ficheEnrolement(matricule: string): Promise<Blob>;
  /** Démonstration uniquement : efface les agents créés pendant les essais. */
  reinitialiserDemonstration?(): void;
}

export const agentsService: AgentsService = config.sourceDonnees === 'api' ? agentsApi : agentsDemo;
