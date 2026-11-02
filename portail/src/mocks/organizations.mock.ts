/**
 * DONNÉES FICTIVES — mode démonstration uniquement.
 * Organigramme et postes simplifiés, inventés pour illustrer le parcours d'enrôlement.
 * En mode API, ces données viendront de la base de l'API d'administration.
 */
import type { Poste } from '@/types/position';
import type { Structure } from '@/types/structure';

export const structuresDemo: Structure[] = [
  // Ministère de la Santé (fictif)
  { code: 'sante', libelle: 'Ministère de la Santé', sigle: 'MS', type: 'ministere' },
  { code: 'sante-sg', libelle: 'Secrétariat général', sigle: 'SG', type: 'direction', parent: 'sante' },
  { code: 'sante-sg-cab', libelle: 'Service du courrier et de la coordination', type: 'service', parent: 'sante-sg' },
  { code: 'sante-drh', libelle: 'Direction des ressources humaines', sigle: 'DRH', type: 'direction', parent: 'sante' },
  { code: 'sante-drh-sgc', libelle: 'Service de la gestion des carrières', type: 'service', parent: 'sante-drh' },
  { code: 'sante-drh-sfp', libelle: 'Service de la formation du personnel', type: 'service', parent: 'sante-drh' },
  { code: 'sante-dsi', libelle: "Direction des systèmes d'information", sigle: 'DSI', type: 'direction', parent: 'sante' },
  { code: 'sante-dsi-sinf', libelle: 'Service des infrastructures', type: 'service', parent: 'sante-dsi' },
  { code: 'sante-dh', libelle: 'Direction des hôpitaux', sigle: 'DH', type: 'direction', parent: 'sante' },
  { code: 'sante-dh-sah', libelle: "Service de l'administration hospitalière", type: 'service', parent: 'sante-dh' },
  { code: 'sante-dh-sqs', libelle: 'Service de la qualité des soins', type: 'service', parent: 'sante-dh' },
  { code: 'sante-ig', libelle: 'Inspection générale', sigle: 'IG', type: 'direction', parent: 'sante' },
  { code: 'sante-ig-sc', libelle: 'Service du contrôle', type: 'service', parent: 'sante-ig' },
  { code: 'sante-arch', libelle: 'Direction des archives', type: 'direction', parent: 'sante' },
  { code: 'sante-arch-sc', libelle: 'Service de la conservation', type: 'service', parent: 'sante-arch' },

  // Ministère des Finances (fictif)
  { code: 'finances', libelle: 'Ministère des Finances', sigle: 'MF', type: 'ministere' },
  { code: 'finances-dsi', libelle: "Direction des systèmes d'information", sigle: 'DSI', type: 'direction', parent: 'finances' },
  { code: 'finances-dsi-sinf', libelle: 'Service des infrastructures', type: 'service', parent: 'finances-dsi' },

  // Ministère chargé du numérique (fictif)
  { code: 'numerique', libelle: 'Ministère de la Transition digitale', sigle: 'MTD', type: 'ministere' },
  { code: 'numerique-dgtd', libelle: 'Direction générale de la transformation digitale', sigle: 'DGTD', type: 'direction', parent: 'numerique' },
  { code: 'numerique-dgtd-splat', libelle: 'Service des plateformes', type: 'service', parent: 'numerique-dgtd' },
];

export const postesDemo: Poste[] = [
  { code: 'SG-SANTE', intitule: 'Secrétaire général', structure: 'sante-sg', habilitationRequise: 'confidentiel' },
  { code: 'AGT-SG-SANTE', intitule: 'Chargé du courrier', structure: 'sante-sg-cab', posteSuperieur: 'SG-SANTE', habilitationRequise: 'diffusion_restreinte' },
  { code: 'DRH-SANTE', intitule: 'Directeur des ressources humaines', structure: 'sante-drh', posteSuperieur: 'SG-SANTE', habilitationRequise: 'confidentiel' },
  { code: 'ADJ-DRH-SANTE', intitule: 'Directeur adjoint des ressources humaines', structure: 'sante-drh', posteSuperieur: 'DRH-SANTE', habilitationRequise: 'confidentiel' },
  { code: 'RH-SANTE', intitule: 'Gestionnaire des ressources humaines', structure: 'sante-drh-sgc', posteSuperieur: 'DRH-SANTE', habilitationRequise: 'normal' },
  { code: 'CS-SGC-SANTE', intitule: 'Chef du service de la gestion des carrières', structure: 'sante-drh-sgc', posteSuperieur: 'DRH-SANTE', habilitationRequise: 'diffusion_restreinte' },
  { code: 'AGT-SFP-SANTE', intitule: 'Chargé de la formation', structure: 'sante-drh-sfp', posteSuperieur: 'DRH-SANTE', habilitationRequise: 'normal' },
  { code: 'DSI-SANTE', intitule: "Directeur des systèmes d'information", structure: 'sante-dsi', posteSuperieur: 'SG-SANTE', habilitationRequise: 'normal' },
  { code: 'AGT-DSI-SANTE', intitule: 'Technicien informatique', structure: 'sante-dsi-sinf', posteSuperieur: 'DSI-SANTE', habilitationRequise: 'normal' },
  { code: 'DH-SANTE', intitule: 'Directeur des hôpitaux', structure: 'sante-dh', posteSuperieur: 'SG-SANTE', habilitationRequise: 'diffusion_restreinte' },
  { code: 'AGT-DH-SANTE', intitule: "Chargé d'études, Direction des hôpitaux", structure: 'sante-dh-sah', posteSuperieur: 'DH-SANTE', habilitationRequise: 'normal' },
  { code: 'CS-SQS-SANTE', intitule: 'Chef du service de la qualité des soins', structure: 'sante-dh-sqs', posteSuperieur: 'DH-SANTE', habilitationRequise: 'diffusion_restreinte' },
  { code: 'IG-SANTE', intitule: 'Inspecteur', structure: 'sante-ig-sc', habilitationRequise: 'normal' },
  { code: 'ARCH-SANTE', intitule: 'Archiviste', structure: 'sante-arch-sc', habilitationRequise: 'normal' },

  { code: 'DSI-FINANCES', intitule: "Directeur des systèmes d'information", structure: 'finances-dsi', habilitationRequise: 'normal' },
  { code: 'AGT-DSI-FINANCES', intitule: 'Technicien informatique', structure: 'finances-dsi-sinf', posteSuperieur: 'DSI-FINANCES', habilitationRequise: 'normal' },

  { code: 'DGTD', intitule: 'Directeur général de la transformation digitale', structure: 'numerique-dgtd', habilitationRequise: 'normal' },
];
