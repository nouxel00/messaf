/**
 * COMPTES FICTIFS — mode démonstration uniquement, jamais utilisés avec Keycloak.
 * Les rôles reprennent le jeu de données du document de démarrage (section 10).
 * Le mot de passe de démonstration est public et volontairement unique : il ne protège rien.
 */
import type { Role } from '@/types/messaf';

export const MOT_DE_PASSE_DEMO = 'demo';

export interface CompteDemo {
  identifiant: string;
  matricule: string;
  nomComplet: string;
  roles: Role[];
  ministere: string;
  poste: string;
  /** Ce que ce compte permet de montrer pendant la démonstration. */
  usage: string;
}

export const comptesDemo: CompteDemo[] = [
  {
    identifiant: '100003',
    matricule: '100003',
    nomComplet: 'Mariam Traoré',
    roles: ['gestionnaire_rh'],
    ministere: 'sante',
    poste: 'Gestionnaire RH — Santé',
    usage: 'Enrôlement des agents du ministère de la Santé',
  },
  {
    identifiant: '100002',
    matricule: '100002',
    nomComplet: 'Paul Zongo',
    roles: ['admin_ministere'],
    ministere: 'sante',
    poste: 'DSI Santé',
    usage: 'Révocation et réactivation des accès des agents de la Santé',
  },
  {
    identifiant: '100004',
    matricule: '100004',
    nomComplet: 'Jean Compaoré',
    roles: ['superieur'],
    ministere: 'sante',
    poste: 'Secrétaire général — Santé',
    usage: "Validation des intérims des directeurs qu'il encadre",
  },
  {
    identifiant: '100009',
    matricule: '100009',
    nomComplet: 'Salif Ouattara',
    roles: ['auditeur'],
    ministere: 'sante',
    poste: 'Inspecteur, Inspection générale — Santé',
    usage: "Lecture du journal d'audit du ministère de la Santé",
  },
  {
    identifiant: '100011',
    matricule: '100011',
    nomComplet: 'Boukary Nikéma',
    roles: ['admin_ministere'],
    ministere: 'finances',
    poste: 'DSI Finances',
    usage: 'Cloisonnement : administrateur des Finances, aucun agent de la Santé visible',
  },
  {
    identifiant: '100008',
    matricule: '100008',
    nomComplet: 'Fatimata Diallo',
    roles: [],
    ministere: 'sante',
    poste: 'Agent, Direction des hôpitaux',
    usage: "Refus d'accès : agent sans rôle, messagerie uniquement",
  },
];
