import { useSession } from '@/contexts/AuthContext';
import { agentsService } from '@/services/agents.service';
import { useAsync } from './useAsync';

/** Agents du périmètre de l'utilisateur connecté. */
export function useAgents() {
  const session = useSession();
  return useAsync(() => agentsService.lister({ ministere: session.ministere }), [session.ministere]);
}

export function useAgent(matricule: string) {
  const session = useSession();
  return useAsync(
    () => agentsService.obtenir(matricule, { ministere: session.ministere }),
    [matricule, session.ministere],
  );
}
