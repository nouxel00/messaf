import { Navigate } from 'react-router-dom';
import { useSession } from '@/contexts/AuthContext';
import { peutConsulterAgents, peutEnroler } from '@/utils/permissions';
import { TableauDeBordPage } from './dashboard/TableauDeBordPage';

/** Première page selon le rôle : enrôlement (RH), agents (administrateur), journal (auditeur). */
export function AccueilPage() {
  const session = useSession();
  if (peutEnroler(session)) return <TableauDeBordPage />;
  if (peutConsulterAgents(session)) return <Navigate to="/agents" replace />;
  return <Navigate to="/audit" replace />;
}
