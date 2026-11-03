/** Journal d'audit : stocké par l'API, en ajout seul (ni modification ni suppression possible). */
export type ResultatAudit = 'succes' | 'refus' | 'echec';

export interface EntreeAudit {
  id: number;
  /** Date et heure (ISO 8601). */
  horodatage: string;
  /** Identifiant (matricule) de l'auteur de l'action. */
  auteur: string;
  /** Code technique de l'action, ex. `revocation`. */
  action: string;
  /** Matricule de l'agent concerné. */
  cible?: string;
  ministere?: string;
  resultat: ResultatAudit;
  /** Précisions : motif, nombre de sessions fermées, poste, raison d'un refus… */
  detail?: Record<string, unknown>;
}

export const LIBELLES_ACTION_AUDIT: Record<string, string> = {
  creation_agent: "Création d'un agent",
  fiche_enrolement: "Émission de la fiche d'enrôlement",
  revocation: 'Révocation',
  reactivation: 'Réactivation',
};

export const LIBELLES_RESULTAT_AUDIT: Record<ResultatAudit, string> = {
  succes: 'Réussi',
  refus: 'Refusé',
  echec: 'Échec',
};
