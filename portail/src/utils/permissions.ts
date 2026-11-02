import { ROLES_ESPACE_RH } from '@/config/messaf';
import type { SessionUtilisateur } from '@/types/auth';

/**
 * Contrôle d'affichage uniquement. L'API vérifie le rôle et le ministère à chaque appel :
 * ce test ne protège aucune donnée, il évite seulement de montrer un écran inutilisable.
 */
export function peutAccederEspaceRH(session: SessionUtilisateur | null): boolean {
  return !!session && session.roles.some((r) => ROLES_ESPACE_RH.includes(r));
}
