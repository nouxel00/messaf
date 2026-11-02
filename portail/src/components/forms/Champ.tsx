import { CircleAlert } from 'lucide-react';
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

interface Props {
  label: string;
  requis?: boolean;
  aide?: ReactNode;
  erreur?: string;
  className?: string;
  /** Un seul contrôle (input, select…) : il reçoit l'id et les attributs ARIA. */
  children: ReactElement<Record<string, unknown>>;
}

/** Libellé, aide et message d'erreur reliés au contrôle pour les lecteurs d'écran. */
export function Champ({ label, requis, aide, erreur, className = '', children }: Props) {
  const id = useId();
  const idAide = `${id}-aide`;
  const idErreur = `${id}-erreur`;
  const decrit = [aide && idAide, erreur && idErreur].filter(Boolean).join(' ') || undefined;

  const controle = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': erreur ? true : undefined,
        'aria-describedby': decrit,
        'aria-required': requis || undefined,
      })
    : children;

  return (
    <div className={`champ ${className}`}>
      <label className="champ-label" htmlFor={id}>
        {label}
        {requis ? (
          <span className="requis" aria-hidden>
            *
          </span>
        ) : (
          <span className="facultatif">(facultatif)</span>
        )}
      </label>
      {controle}
      {aide && (
        <p className="champ-aide" id={idAide}>
          {aide}
        </p>
      )}
      {erreur && (
        <p className="champ-erreur" id={idErreur}>
          <CircleAlert size={14} aria-hidden />
          {erreur}
        </p>
      )}
    </div>
  );
}
