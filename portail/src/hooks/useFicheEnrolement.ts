import { useCallback, useEffect, useRef, useState } from 'react';
import { agentsService } from '@/services/agents.service';

/** Demande la fiche PDF une seule fois et garde une URL locale pour l'aperçu et le téléchargement. */
export function useFicheEnrolement(matricule: string) {
  const [url, setUrl] = useState<string>();
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<unknown>();
  const enCours = useRef(false);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  const demander = useCallback(async (): Promise<string | undefined> => {
    if (url) return url;
    if (enCours.current) return undefined;
    enCours.current = true;
    setChargement(true);
    setErreur(undefined);
    try {
      const blob = await agentsService.ficheEnrolement(matricule);
      const nouvelle = URL.createObjectURL(blob);
      setUrl(nouvelle);
      return nouvelle;
    } catch (e) {
      setErreur(e);
      return undefined;
    } finally {
      enCours.current = false;
      setChargement(false);
    }
  }, [matricule, url]);

  return { url, chargement, erreur, demander };
}
