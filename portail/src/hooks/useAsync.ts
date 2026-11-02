import { useCallback, useEffect, useRef, useState } from 'react';

export interface EtatAsync<T> {
  donnees: T | undefined;
  erreur: unknown;
  chargement: boolean;
  recharger: () => void;
}

/** Exécute une lecture asynchrone et ignore les réponses arrivées après un changement de paramètres. */
export function useAsync<T>(charger: () => Promise<T>, dependances: unknown[]): EtatAsync<T> {
  const [donnees, setDonnees] = useState<T>();
  const [erreur, setErreur] = useState<unknown>();
  const [chargement, setChargement] = useState(true);
  const [version, setVersion] = useState(0);
  const chargeur = useRef(charger);
  chargeur.current = charger;

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(undefined);
    chargeur
      .current()
      .then((resultat) => actif && setDonnees(resultat))
      .catch((e: unknown) => actif && setErreur(e))
      .finally(() => actif && setChargement(false));
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependances, version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  return { donnees, erreur, chargement, recharger };
}
