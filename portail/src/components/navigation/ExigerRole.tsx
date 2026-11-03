import { Lock } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { useSession } from '@/contexts/AuthContext';
import { LIBELLES_ROLE, type Role } from '@/types/messaf';
import { aUnDesRoles } from '@/utils/permissions';
import { Alerte } from '../ui/Alerte';

/**
 * Réserve un groupe de pages à certains rôles, à l'intérieur du portail.
 * Confort d'affichage : l'API refuse de toute façon un appel non autorisé (403).
 */
export function ExigerRole({ roles }: { roles: readonly Role[] }) {
  const session = useSession();
  if (aUnDesRoles(session, roles)) return <Outlet />;
  return (
    <Alerte ton="attention" titre="Page réservée">
      <p style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Lock size={16} aria-hidden />
        Cette page est réservée aux rôles : {roles.map((r) => LIBELLES_ROLE[r]).join(', ')}.
      </p>
    </Alerte>
  );
}
