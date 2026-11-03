import { config } from '@/config/env';
import type { EntreeAudit } from '@/types/audit';
import { auditApi } from './audit.api';
import { auditDemo } from './demo/audit.demo';

/** Journal d'audit, en lecture seule (rôle auditeur). Choix démo/API par VITE_DATA_SOURCE. */
export interface AuditService {
  readonly simulation: boolean;
  /** Entrées du ministère, de la plus récente à la plus ancienne. */
  journal(ministere: string, limite?: number): Promise<EntreeAudit[]>;
}

export const auditService: AuditService = config.sourceDonnees === 'api' ? auditApi : auditDemo;
