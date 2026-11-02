import { LoaderCircle } from 'lucide-react';

export function Chargeur({ libelle = 'Chargement…' }: { libelle?: string }) {
  return (
    <div className="chargeur" role="status">
      <LoaderCircle size={20} className="tourne" aria-hidden />
      <span>{libelle}</span>
    </div>
  );
}

export function IconeChargement({ taille = 16 }: { taille?: number }) {
  return <LoaderCircle size={taille} className="tourne" aria-hidden />;
}
