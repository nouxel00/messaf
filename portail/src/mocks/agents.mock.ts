/**
 * DONNÉES FICTIVES — jeu commun du document de démarrage (section 10).
 * Ces personnes n'existent pas. Adresses en .example (domaine réservé, jamais délivré).
 */
import type { Habilitation } from '@/types/messaf';

export interface AgentDemo {
  matricule: string;
  nom: string;
  prenoms: string;
  email: string;
  telephone?: string;
  ministere: string;
  direction: string;
  service: string;
  poste: string;
  habilitation: Habilitation;
  dateDebut: string;
  creeLe: string;
}

const domaine = (ministere: string) => `${ministere}.messaf.example`;

export const agentsDemo: AgentDemo[] = [
  { matricule: '100001', nom: 'National', prenoms: 'Admin', email: `admin.national@${domaine('numerique')}`, ministere: 'numerique', direction: 'numerique-dgtd', service: 'numerique-dgtd-splat', poste: 'DGTD', habilitation: 'normal', dateDebut: '2026-01-05', creeLe: '2026-10-01T08:00:00Z' },
  { matricule: '100002', nom: 'Zongo', prenoms: 'Paul', email: `paul.zongo@${domaine('sante')}`, telephone: '+226 70 00 00 02', ministere: 'sante', direction: 'sante-dsi', service: 'sante-dsi-sinf', poste: 'DSI-SANTE', habilitation: 'normal', dateDebut: '2025-03-01', creeLe: '2026-10-01T08:10:00Z' },
  { matricule: '100003', nom: 'Traoré', prenoms: 'Mariam', email: `mariam.traore@${domaine('sante')}`, telephone: '+226 70 00 00 03', ministere: 'sante', direction: 'sante-drh', service: 'sante-drh-sgc', poste: 'RH-SANTE', habilitation: 'normal', dateDebut: '2024-09-02', creeLe: '2026-10-01T08:20:00Z' },
  { matricule: '100004', nom: 'Compaoré', prenoms: 'Jean', email: `jean.compaore@${domaine('sante')}`, ministere: 'sante', direction: 'sante-sg', service: 'sante-sg-cab', poste: 'SG-SANTE', habilitation: 'confidentiel', dateDebut: '2023-06-12', creeLe: '2026-10-02T09:00:00Z' },
  { matricule: '100005', nom: 'Ouédraogo', prenoms: 'Awa', email: `awa.ouedraogo@${domaine('sante')}`, telephone: '+226 70 00 00 05', ministere: 'sante', direction: 'sante-drh', service: 'sante-drh-sgc', poste: 'DRH-SANTE', habilitation: 'confidentiel', dateDebut: '2024-01-15', creeLe: '2026-10-02T09:15:00Z' },
  { matricule: '100006', nom: 'Sawadogo', prenoms: 'Issa', email: `issa.sawadogo@${domaine('sante')}`, ministere: 'sante', direction: 'sante-drh', service: 'sante-drh-sgc', poste: 'ADJ-DRH-SANTE', habilitation: 'confidentiel', dateDebut: '2024-04-01', creeLe: '2026-10-03T10:00:00Z' },
  { matricule: '100007', nom: 'Kaboré', prenoms: 'Moussa', email: `moussa.kabore@${domaine('sante')}`, ministere: 'sante', direction: 'sante-dh', service: 'sante-dh-sah', poste: 'DH-SANTE', habilitation: 'diffusion_restreinte', dateDebut: '2022-11-07', creeLe: '2026-10-05T11:30:00Z' },
  { matricule: '100008', nom: 'Diallo', prenoms: 'Fatimata', email: `fatimata.diallo@${domaine('sante')}`, telephone: '+226 70 00 00 08', ministere: 'sante', direction: 'sante-dh', service: 'sante-dh-sah', poste: 'AGT-DH-SANTE', habilitation: 'normal', dateDebut: '2025-02-03', creeLe: '2026-10-06T14:00:00Z' },
  { matricule: '100009', nom: 'Ouattara', prenoms: 'Salif', email: `salif.ouattara@${domaine('sante')}`, ministere: 'sante', direction: 'sante-ig', service: 'sante-ig-sc', poste: 'IG-SANTE', habilitation: 'normal', dateDebut: '2023-01-09', creeLe: '2026-10-08T08:45:00Z' },
  { matricule: '100010', nom: 'Sanogo', prenoms: 'Aminata', email: `aminata.sanogo@${domaine('sante')}`, ministere: 'sante', direction: 'sante-arch', service: 'sante-arch-sc', poste: 'ARCH-SANTE', habilitation: 'normal', dateDebut: '2024-07-01', creeLe: '2026-10-09T15:20:00Z' },
  { matricule: '100011', nom: 'Nikéma', prenoms: 'Boukary', email: `boukary.nikema@${domaine('finances')}`, ministere: 'finances', direction: 'finances-dsi', service: 'finances-dsi-sinf', poste: 'DSI-FINANCES', habilitation: 'normal', dateDebut: '2025-05-05', creeLe: '2026-10-10T09:00:00Z' },
];
