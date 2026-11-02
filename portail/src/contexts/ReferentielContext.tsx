import { createContext, useContext, type ReactNode } from 'react';
import { useReferentiel } from '@/hooks/useReferentiel';

type ValeurReferentiel = ReturnType<typeof useReferentiel>;

const ReferentielContext = createContext<ValeurReferentiel | null>(null);

/** Charge une seule fois l'organigramme du ministère de l'utilisateur pour tout l'espace RH. */
export function ReferentielProvider({ ministere, children }: { ministere: string; children: ReactNode }) {
  const valeur = useReferentiel(ministere);
  return <ReferentielContext.Provider value={valeur}>{children}</ReferentielContext.Provider>;
}

export function useReferentielRH(): ValeurReferentiel {
  const valeur = useContext(ReferentielContext);
  if (!valeur) throw new Error('useReferentielRH doit être utilisé sous <ReferentielProvider>.');
  return valeur;
}
