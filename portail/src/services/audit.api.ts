import { routesApi } from '@/config/api';
import type { ResultatAudit } from '@/types/audit';
import { api } from './api';
import type { AuditService } from './audit.service';

/** GET /audit?ministere=…&limite=… — réservé au rôle auditeur (et super_admin). */
interface EntreeAuditApi {
  id: number;
  horodatage: string;
  auteur: string;
  action: string;
  cible: string | null;
  ministere: string | null;
  resultat: ResultatAudit;
  detail: Record<string, unknown> | null;
}

export const auditApi: AuditService = {
  simulation: false,
  async journal(ministere, limite = 200) {
    const entrees = await api.json<EntreeAuditApi[]>(routesApi.audit(ministere, limite));
    return entrees.map((e) => ({
      ...e,
      cible: e.cible ?? undefined,
      ministere: e.ministere ?? undefined,
      detail: e.detail ?? undefined,
    }));
  },
};
