import type { AuditService } from '../audit.service';
import { lireJournalDemo } from './journal.demo';
import { latence } from './outils';

/** SIMULATION : journal fictif tenu dans le navigateur (voir journal.demo.ts). */
export const auditDemo: AuditService = {
  simulation: true,
  async journal(ministere, limite = 200) {
    await latence(200, 500);
    return lireJournalDemo()
      .filter((e) => e.ministere === ministere)
      .sort((a, b) => b.id - a.id)
      .slice(0, limite);
  },
};
