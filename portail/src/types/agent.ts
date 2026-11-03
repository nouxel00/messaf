import type { Affectation } from './assignment';
import type { Identite } from './identity';
import type { EtatCompte, Habilitation } from './messaf';
import type { Poste } from './position';
import type { ProfilProfessionnel } from './profile';

/** `en_attente` tant que l'agent n'a pas fait sa première connexion avec son code d'activation. */
export type EtatEnrolement = 'en_attente' | 'termine';

/**
 * Vue consolidée d'un agent, telle que le portail l'affiche.
 * Elle assemble les quatre objets du modèle MESSAF sans les fusionner.
 */
export interface Agent {
  identite: Identite;
  profil: ProfilProfessionnel;
  /** Attribut Keycloak `habilitation`. */
  habilitation: Habilitation;
  /** Attribut Keycloak `etat`, quand il est connu. */
  etat?: EtatCompte;
  /** Avancement de l'enrôlement, quand il est connu (API). */
  enrolement?: EtatEnrolement;
  /** Identifiant Matrix : @m<matricule>:gov.bf */
  matrixId: string;
  /** Affectation en cours, si connue. */
  affectation?: Affectation;
  /** Poste de l'affectation en cours, si connu. */
  poste?: Poste;
  /** Date de création du compte (ISO 8601), si connue. */
  creeLe?: string;
}

/** Données saisies dans le parcours de création, avant envoi à l'API. */
export interface NouvelAgent {
  identite: Identite;
  profil: ProfilProfessionnel;
  /** L'affectation porte le poste choisi ; le matricule est celui de l'identité. */
  affectation: Omit<Affectation, 'matricule'>;
  habilitation: Habilitation;
}

export interface ResultatCreationAgent {
  agent: Agent;
  /** Vrai quand la création a été simulée par le mode démonstration. */
  simulee: boolean;
}

export interface FiltreAgents {
  /** Périmètre du responsable connecté : le serveur reste seul garant du cloisonnement. */
  ministere: string;
}

/** Résultat d'une révocation : le compte est bloqué et ses sessions sont fermées. */
export interface ResultatRevocation {
  etat: EtatCompte;
  /** Nombre de sessions fermées (applications, navigateur, jetons personnels). */
  sessionsFermees: number;
}
