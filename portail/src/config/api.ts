/**
 * Routes de l'API d'administration définies dans le document de démarrage (section 5).
 * Le contrat détaillé (corps JSON, codes d'erreur) doit venir de api/openapi.yaml, à valider avec Axel.
 */
export const routesApi = {
  /** POST — créer un agent. */
  creerAgent: () => '/agents',
  /** GET — fiche PDF d'enrôlement avec le code d'activation. */
  ficheEnrolement: (matricule: string) => `/agents/${encodeURIComponent(matricule)}/fiche-enrolement`,
} as const;
