import { routesApi } from '@/config/api';
import type { Agent, NouvelAgent } from '@/types/agent';
import type { EtatCompte, Habilitation } from '@/types/messaf';
import { construireMatrixId } from '@/utils/matrix';
import { api } from './api';
import type { AgentsService } from './agents.service';
import { NonDisponibleError } from './errors';

/**
 * Implémentation réelle, par l'API d'administration d'Axel.
 *
 * Routes confirmées par le document de démarrage :
 *   POST /agents                              → creer()
 *   GET  /agents/{matricule}/fiche-enrolement → ficheEnrolement()
 *
 * HYPOTHÈSE PROVISOIRE — à remplacer par le schéma de api/openapi.yaml une fois validé :
 * le corps JSON ci-dessous reprend la séparation identité / profil / affectation et les
 * noms techniques en minuscules sans accents (règle 7 du document de démarrage).
 */
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

/** Réponse attendue, lue de façon tolérante tant que le contrat n'est pas figé. */
interface CreerAgentReponse {
  matricule?: string;
  matrix_id?: string;
  etat?: EtatCompte;
  cree_le?: string;
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

const routeAbsente = (fonction: string) =>
  new NonDisponibleError(
    `${fonction} : aucune route n'est encore définie dans le contrat de l'API. Point à valider avec Axel.`,
  );

export const agentsApi: AgentsService = {
  simulation: false,

  // POINT À VALIDER : pas de route de consultation (GET /agents) dans le document de démarrage.
  async lister() {
    throw routeAbsente('La liste des agents');
  },
  async obtenir() {
    throw routeAbsente("La consultation d'un agent");
  },

  // Sans route dédiée, l'unicité du matricule est vérifiée par le serveur au POST (409 attendu).
  async matriculeDisponible() {
    return null;
  },

  async creer(nouvel) {
    const reponse = await api.json<CreerAgentReponse>(routesApi.creerAgent(), {
      method: 'POST',
      corps: versRequete(nouvel),
    });
    const matricule = reponse.matricule ?? nouvel.identite.matricule;
    const agent: Agent = {
      identite: nouvel.identite,
      profil: nouvel.profil,
      habilitation: nouvel.habilitation,
      etat: reponse.etat,
      matrixId: reponse.matrix_id ?? construireMatrixId(matricule),
      affectation: { matricule, ...nouvel.affectation },
      creeLe: reponse.cree_le,
    };
    return { agent, simulee: false };
  },

  ficheEnrolement(matricule) {
    return api.blob(routesApi.ficheEnrolement(matricule), { accept: 'application/pdf' });
  },
};
