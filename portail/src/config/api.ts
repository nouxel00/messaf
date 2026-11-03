/**
 * Routes de l'API d'administration utilisées par le portail.
 * Contrat détaillé (corps JSON, codes d'erreur) : api/openapi.yaml, ou http://localhost:8000/docs.
 */
const agent = (matricule: string) => `/agents/${encodeURIComponent(matricule)}`;
const parMinistere = (chemin: string, ministere: string) => `${chemin}?ministere=${encodeURIComponent(ministere)}`;

export const routesApi = {
  /** GET — agents d'un ministère ; POST — créer un agent. */
  agents: (ministere?: string) => (ministere ? parMinistere('/agents', ministere) : '/agents'),
  /** GET — un agent. */
  agent,
  /** GET — fiche PDF d'enrôlement, avec un nouveau code d'activation (le précédent est annulé). */
  ficheEnrolement: (matricule: string) => `${agent(matricule)}/fiche-enrolement`,
  /** GET — le ministère et toutes ses directions et services. */
  structures: (ministere: string) => parMinistere('/structures', ministere),
  /** GET — les postes rattachés aux structures du ministère. */
  postes: (ministere: string) => parMinistere('/postes', ministere),
} as const;
