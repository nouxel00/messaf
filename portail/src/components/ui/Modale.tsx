import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  ouverte: boolean;
  titre: string;
  children: ReactNode;
  actions: ReactNode;
  /** Appelée sur Échap ou clic hors de la fenêtre, sauf si `bloquee`. */
  fermer: () => void;
  bloquee?: boolean;
}

export function Modale({ ouverte, titre, children, actions, fermer, bloquee = false }: Props) {
  const idTitre = useId();
  const boite = useRef<HTMLDivElement>(null);
  // Dernières valeurs, lues au moment de la touche Échap. Sans ces références, chaque nouvel
  // affichage du parent (une lettre tapée dans un champ de la fenêtre) relançait l'effet
  // ci-dessous, qui reprenait le focus : il fallait recliquer dans le champ après chaque lettre.
  const fermerActuel = useRef(fermer);
  fermerActuel.current = fermer;
  const bloqueeActuelle = useRef(bloquee);
  bloqueeActuelle.current = bloquee;

  // Une seule fois par ouverture : focus initial, touche Échap, focus rendu à la fermeture
  useEffect(() => {
    if (!ouverte) return;
    const precedent = document.activeElement as HTMLElement | null;
    boite.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !bloqueeActuelle.current) fermerActuel.current();
    };
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('keydown', surTouche);
      precedent?.focus();
    };
  }, [ouverte]);

  if (!ouverte) return null;
  return (
    <div className="modale-fond" onMouseDown={(e) => e.target === e.currentTarget && !bloquee && fermer()}>
      <div className="modale" role="dialog" aria-modal="true" aria-labelledby={idTitre} ref={boite}>
        <div className="modale-corps">
          <h2 id={idTitre}>{titre}</h2>
          {children}
        </div>
        <div className="modale-actions">{actions}</div>
      </div>
    </div>
  );
}
