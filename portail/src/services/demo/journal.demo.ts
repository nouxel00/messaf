import type { EntreeAudit, ResultatAudit } from '@/types/audit';
import { sessionDemoCourante } from './auth.demo';
import { ecrireStockage, lireStockage } from './outils';

/**
 * SIMULATION du journal d'audit, dans le localStorage du navigateur.
 * Quelques entrées fictives de départ, puis les actions faites pendant les essais.
 * (Le vrai journal est tenu par l'API, en ajout seul.)
 */
const CLE_JOURNAL = 'messaf.demo.journal.v1';

const DEPART: EntreeAudit[] = [
  { id: 1, horodatage: '2026-10-09T15:20:00Z', auteur: '100003', action: 'creation_agent', cible: '100010', ministere: 'sante', resultat: 'succes', detail: { poste: 'ARCH-SANTE', habilitation: 'normal' } },
  { id: 2, horodatage: '2026-10-09T15:24:00Z', auteur: '100003', action: 'fiche_enrolement', cible: '100010', ministere: 'sante', resultat: 'succes' },
  { id: 3, horodatage: '2026-10-12T10:02:00Z', auteur: '100003', action: 'revocation', cible: '100008', ministere: 'sante', resultat: 'refus', detail: { motif: 'Votre rôle ne permet pas cette opération.' } },
  { id: 4, horodatage: '2026-10-12T10:05:00Z', auteur: '100002', action: 'revocation', cible: '100008', ministere: 'sante', resultat: 'succes', detail: { motif: 'Téléphone professionnel perdu', sessions_fermees: 2 } },
  { id: 5, horodatage: '2026-10-12T16:40:00Z', auteur: '100002', action: 'reactivation', cible: '100008', ministere: 'sante', resultat: 'succes', detail: { motif: 'Nouveau téléphone remis à l’agent' } },
];

export function lireJournalDemo(): EntreeAudit[] {
  return lireStockage<EntreeAudit[]>(localStorage, CLE_JOURNAL, DEPART);
}

export function journaliserDemo(
  action: string,
  resultat: ResultatAudit,
  cible: string,
  ministere: string,
  detail?: Record<string, unknown>,
): void {
  const journal = lireJournalDemo();
  const entree: EntreeAudit = {
    id: Math.max(0, ...journal.map((e) => e.id)) + 1,
    horodatage: new Date().toISOString(),
    auteur: sessionDemoCourante()?.identifiant ?? 'inconnu',
    action,
    cible,
    ministere,
    resultat,
    detail,
  };
  ecrireStockage(localStorage, CLE_JOURNAL, [...journal, entree]);
}

export function reinitialiserJournalDemo(): void {
  ecrireStockage(localStorage, CLE_JOURNAL, DEPART);
}
