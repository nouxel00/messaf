import { CircleAlert, CircleCheck, FlaskConical, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

type Ton = 'info' | 'succes' | 'attention' | 'erreur' | 'demo';

const icones = {
  info: Info,
  succes: CircleCheck,
  attention: TriangleAlert,
  erreur: CircleAlert,
  demo: FlaskConical,
};

interface Props {
  ton?: Ton;
  titre?: string;
  children?: ReactNode;
  className?: string;
}

export function Alerte({ ton = 'info', titre, children, className = '' }: Props) {
  const Icone = icones[ton];
  return (
    <div className={`alerte alerte-${ton} ${className}`} role={ton === 'erreur' ? 'alert' : 'status'}>
      <Icone size={18} aria-hidden />
      <div>
        {titre && <p className="alerte-titre">{titre}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
