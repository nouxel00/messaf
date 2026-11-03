import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { peutAccederPortail } from '@/utils/permissions';
import { Chargeur } from '../ui/Chargeur';
import { AccesRefuse } from './AccesRefuse';

/**
 * Garde le portail : session ouverte et au moins un rôle du portail (chaque page vérifie ensuite le sien).
 * C'est un confort d'affichage : l'API refusera de toute façon un appel non autorisé.
 */
export function RouteProtegee() {
  const { session, initialisation } = useAuth();
  const location = useLocation();

  if (initialisation) return <Chargeur libelle="Vérification de la session…" />;
  if (!session) return <Navigate to="/connexion" replace state={{ depuis: location.pathname }} />;
  if (!peutAccederPortail(session)) return <AccesRefuse />;
  return <Outlet />;
}
