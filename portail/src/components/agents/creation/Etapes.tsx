import { Check } from 'lucide-react';

export interface DefinitionEtape {
  titre: string;
  sousTitre: string;
}

interface Props {
  etapes: DefinitionEtape[];
  courante: number;
  /** Dernière étape accessible : toutes celles d'avant sont complètes. */
  atteinte: number;
  aller: (index: number) => void;
}

/** Indicateur de progression : liste verticale sur grand écran, barre compacte sur petit écran. */
export function Etapes({ etapes, courante, atteinte, aller }: Props) {
  const pourcentage = Math.round(((courante + 1) / etapes.length) * 100);
  return (
    <>
      <nav className="carte etapes-carte" aria-label="Étapes de la création">
        <ol className="etapes">
          {etapes.map((e, i) => {
            const faite = i < atteinte && i !== courante;
            const statut = i === courante ? 'courante' : faite ? 'faite' : '';
            return (
              <li key={e.titre} className={`etape ${statut}`}>
                <button
                  type="button"
                  className="etape-bouton"
                  disabled={i > atteinte || i === courante}
                  onClick={() => aller(i)}
                  aria-current={i === courante ? 'step' : undefined}
                >
                  <span className="etape-pastille">{faite ? <Check size={15} aria-hidden /> : i + 1}</span>
                  <span className="etape-texte">
                    <span className="etape-titre">{e.titre}</span>
                    <span className="etape-sous-titre">{e.sousTitre}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="progression-mobile carte carte-corps" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
          <strong>
            Étape {courante + 1} sur {etapes.length}
          </strong>
          <span style={{ color: 'var(--texte-doux)' }}>{etapes[courante]?.titre}</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={etapes.length}
          aria-valuenow={courante + 1}
          aria-label="Progression"
          style={{ height: 6, background: 'var(--gris-200)', borderRadius: 999, overflow: 'hidden' }}
        >
          <div style={{ width: `${pourcentage}%`, height: '100%', background: 'var(--primaire)', transition: 'width .2s' }} />
        </div>
      </div>
    </>
  );
}
