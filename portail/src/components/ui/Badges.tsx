import { FlaskConical } from 'lucide-react';
import {
  LIBELLES_ETAT,
  LIBELLES_HABILITATION,
  type EtatCompte,
  type Habilitation,
} from '@/types/messaf';

const tonHabilitation: Record<Habilitation, string> = {
  normal: 'badge-neutre',
  diffusion_restreinte: 'badge-or',
  confidentiel: 'badge-rouge',
};

export function BadgeHabilitation({ valeur, technique = false }: { valeur: Habilitation; technique?: boolean }) {
  return (
    <span className={`badge ${tonHabilitation[valeur]}`} title={`Valeur technique : ${valeur}`}>
      {LIBELLES_HABILITATION[valeur]}
      {technique && <code>{valeur}</code>}
    </span>
  );
}

const tonEtat: Record<EtatCompte, string> = {
  actif: 'badge-vert',
  suspendu: 'badge-or',
  revoque: 'badge-rouge',
};

export function BadgeEtat({ valeur }: { valeur?: EtatCompte }) {
  if (!valeur) return <span className="badge badge-neutre">Non communiqué</span>;
  return <span className={`badge badge-point ${tonEtat[valeur]}`}>{LIBELLES_ETAT[valeur]}</span>;
}

export function BadgeDemo({ libelle = 'Démonstration' }: { libelle?: string }) {
  return (
    <span className="badge badge-or">
      <FlaskConical size={12} aria-hidden />
      {libelle}
    </span>
  );
}
