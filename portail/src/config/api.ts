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
  /** POST — révoquer : connexion bloquée, toutes les sessions fermées. */
  revocation: (matricule: string) => `${agent(matricule)}/revocation`,
  /** POST — réactiver un compte révoqué. */
  reactivation: (matricule: string) => `${agent(matricule)}/reactivation`,
  /** GET — journal d'audit du ministère, du plus récent au plus ancien. */
  audit: (ministere: string, limite: number) => `${parMinistere('/audit', ministere)}&limite=${limite}`,
  /** GET — fonctions du ministère (titulaires, intérimaires, salons). */
  fonctions: (ministere: string) => parMinistere('/fonctions', ministere),
  /** GET — passations du ministère ; POST — planifier une passation. */
  passations: (ministere?: string) => (ministere ? parMinistere('/passations', ministere) : '/passations'),
  executionPassation: (id: number) => `/passations/${id}/execution`,
  annulationPassation: (id: number) => `/passations/${id}/annulation`,
  /** GET — absences du ministère ; POST — déclarer une absence. */
  absences: (ministere?: string) => (ministere ? parMinistere('/absences', ministere) : '/absences'),
  validationAbsence: (id: number) => `/absences/${id}/validation`,
  finAbsence: (id: number) => `/absences/${id}/fin`,
  /** GET — le ministère et toutes ses directions et services. */
  structures: (ministere: string) => parMinistere('/structures', ministere),
  /** GET — les postes rattachés aux structures du ministère. */
  postes: (ministere: string) => parMinistere('/postes', ministere),
} as const;
