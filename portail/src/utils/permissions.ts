import {
  ROLES_ABSENCES,
  ROLES_AUDIT,
  ROLES_CONSULTATION,
  ROLES_DECLARATION_ABSENCE,
  ROLES_ENROLEMENT,
  ROLES_PASSATION,
  ROLES_PORTAIL,
  ROLES_REVOCATION,
} from '@/config/messaf';
import type { SessionUtilisateur } from '@/types/auth';
import type { Role } from '@/types/messaf';

/**
 * Contrôles d'affichage uniquement. L'API vérifie le rôle et le ministère à chaque appel :
 * ces tests ne protègent aucune donnée, ils évitent seulement de montrer un écran inutilisable.
 */
export function aUnDesRoles(session: SessionUtilisateur | null, roles: readonly Role[]): boolean {
  return !!session && session.roles.some((r) => roles.includes(r));
}

export const peutAccederPortail = (s: SessionUtilisateur | null) => aUnDesRoles(s, ROLES_PORTAIL);
export const peutEnroler = (s: SessionUtilisateur | null) => aUnDesRoles(s, ROLES_ENROLEMENT);
export const peutConsulterAgents = (s: SessionUtilisateur | null) => aUnDesRoles(s, ROLES_CONSULTATION);
export const peutRevoquer = (s: SessionUtilisateur | null) => aUnDesRoles(s, ROLES_REVOCATION);
export const peutAuditer = (s: SessionUtilisateur | null) => aUnDesRoles(s, ROLES_AUDIT);
export const peutPasser = (s: SessionUtilisateur | null) => aUnDesRoles(s, ROLES_PASSATION);
export const peutSuivreAbsences = (s: SessionUtilisateur | null) => aUnDesRoles(s, ROLES_ABSENCES);
export const peutDeclarerAbsence = (s: SessionUtilisateur | null) => aUnDesRoles(s, ROLES_DECLARATION_ABSENCE);
