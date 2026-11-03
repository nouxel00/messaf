import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { definirFournisseurJeton } from '@/services/api';
import { authService } from '@/services/auth.service';
import type { IdentifiantsConnexion, SessionUtilisateur } from '@/types/auth';

interface ValeurAuth {
  session: SessionUtilisateur | null;
  /** Vrai pendant la reprise de session au chargement. */
  initialisation: boolean;
  connecter(identifiants?: IdentifiantsConnexion): Promise<SessionUtilisateur>;
  deconnecter(): Promise<void>;
}

const AuthContext = createContext<ValeurAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionUtilisateur | null>(null);
  const [initialisation, setInitialisation] = useState(true);

  useEffect(() => {
    definirFournisseurJeton(() => authService.jeton());
    authService.surExpiration?.(() => setSession(null));
    authService
      .restaurer()
      .then(setSession)
      .finally(() => setInitialisation(false));
  }, []);

  const connecter = useCallback(async (identifiants?: IdentifiantsConnexion) => {
    const nouvelle = await authService.connecter(identifiants);
    setSession(nouvelle);
    return nouvelle;
  }, []);

  const deconnecter = useCallback(async () => {
    await authService.deconnecter();
    setSession(null);
  }, []);

  const valeur = useMemo(
    () => ({ session, initialisation, connecter, deconnecter }),
    [session, initialisation, connecter, deconnecter],
  );
  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

export function useAuth(): ValeurAuth {
  const valeur = useContext(AuthContext);
  if (!valeur) throw new Error('useAuth doit être utilisé sous <AuthProvider>.');
  return valeur;
}

/** Session garantie : à utiliser uniquement sous une route protégée. */
export function useSession(): SessionUtilisateur {
  const { session } = useAuth();
  if (!session) throw new Error('Aucune session ouverte.');
  return session;
}
