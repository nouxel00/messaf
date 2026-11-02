import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  icone: LucideIcon;
  titre: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function EtatVide({ icone: Icone, titre, children, action }: Props) {
  return (
    <div className="vide">
      <Icone size={40} aria-hidden />
      <p className="vide-titre">{titre}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
