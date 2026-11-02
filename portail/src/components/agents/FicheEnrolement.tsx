import { Eye, EyeOff, FileDown, FileText } from 'lucide-react';
import { useState } from 'react';
import { routesApi } from '@/config/api';
import { useFicheEnrolement } from '@/hooks/useFicheEnrolement';
import { agentsService } from '@/services/agents.service';
import { messageErreur } from '@/services/errors';
import { MENTION_DEMONSTRATION } from '@/services/demo/fiche.demo';
import { Alerte } from '../ui/Alerte';
import { IconeChargement } from '../ui/Chargeur';

/** Demande, aperçu et téléchargement de la fiche d'enrôlement (GET /agents/{matricule}/fiche-enrolement). */
export function FicheEnrolement({ matricule }: { matricule: string }) {
  const { url, chargement, erreur, demander } = useFicheEnrolement(matricule);
  const [apercu, setApercu] = useState(false);
  const simulation = agentsService.simulation;

  const telecharger = async () => {
    const lien = await demander();
    if (!lien) return;
    const a = document.createElement('a');
    a.href = lien;
    a.download = `fiche-enrolement-${matricule}${simulation ? '-demonstration' : ''}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const basculerApercu = async () => {
    if (apercu) return setApercu(false);
    if (await demander()) setApercu(true);
  };

  return (
    <section className="carte">
      <div className="carte-entete">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={18} aria-hidden />
          Fiche d'enrôlement
        </h2>
        <code className="cellule-secondaire">GET {routesApi.ficheEnrolement(matricule)}</code>
      </div>
      <div className="carte-corps" style={{ display: 'grid', gap: 14 }}>
        <p style={{ fontSize: 14, color: 'var(--texte-doux)' }}>
          La fiche est à remettre à l'agent : elle porte le code d'activation qui lui permet de se connecter à MESSAF
          pour la première fois.
        </p>
        {simulation && (
          <Alerte ton="demo" titre="Fiche fictive">
            Le PDF est généré dans le navigateur, porte la mention « {MENTION_DEMONSTRATION} » et ne contient aucun
            code d'activation.
          </Alerte>
        )}
        {erreur !== undefined && (
          <Alerte ton="erreur" titre="La fiche n'a pas pu être obtenue">
            {messageErreur(erreur)}
          </Alerte>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primaire" onClick={telecharger} disabled={chargement}>
            {chargement ? <IconeChargement /> : <FileDown size={17} aria-hidden />}
            {chargement ? 'Préparation de la fiche…' : 'Télécharger la fiche (PDF)'}
          </button>
          <button type="button" className="btn btn-secondaire" onClick={basculerApercu} disabled={chargement}>
            {apercu ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
            {apercu ? "Masquer l'aperçu" : 'Afficher un aperçu'}
          </button>
        </div>
        {apercu && url && <iframe className="fiche-apercu" src={url} title={`Fiche d'enrôlement ${matricule}`} />}
      </div>
    </section>
  );
}
