import { RefreshCw } from 'lucide-react';
import { messageErreur, NonDisponibleError } from '@/services/errors';
import { Alerte } from './Alerte';

/** Affiche une erreur de lecture, avec un bouton pour réessayer quand c'est utile. */
export function ErreurChargement({ erreur, recharger }: { erreur: unknown; recharger?: () => void }) {
  const nonDisponible = erreur instanceof NonDisponibleError;
  return (
    <Alerte
      ton={nonDisponible ? 'attention' : 'erreur'}
      titre={nonDisponible ? 'Fonction pas encore raccordée' : 'Impossible de charger les données'}
    >
      <p>{messageErreur(erreur)}</p>
      {recharger && !nonDisponible && (
        <button type="button" className="btn btn-secondaire btn-petit" style={{ marginTop: 10 }} onClick={recharger}>
          <RefreshCw size={14} aria-hidden />
          Réessayer
        </button>
      )}
    </Alerte>
  );
}
