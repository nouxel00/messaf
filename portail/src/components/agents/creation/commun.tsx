import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

/** Contrat commun des étapes : chacune reçoit ses valeurs et rend les siennes une fois valides. */
export interface PropsEtape<T> {
  valeurs?: T;
  suivant: (valeurs: T) => void;
  precedent?: () => void;
}

export function ActionsEtape({ precedent, children }: { precedent?: () => void; children: ReactNode }) {
  return (
    <div className="actions-etape">
      {precedent ? (
        <button type="button" className="btn btn-secondaire" onClick={precedent}>
          <ChevronLeft size={17} aria-hidden />
          Étape précédente
        </button>
      ) : (
        <span />
      )}
      <div className="actions-etape-droite">{children}</div>
    </div>
  );
}
