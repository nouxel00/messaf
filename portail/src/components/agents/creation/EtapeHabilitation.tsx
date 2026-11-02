import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRight, CircleAlert } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Alerte } from '@/components/ui/Alerte';
import {
  DESCRIPTIONS_HABILITATION,
  HABILITATIONS,
  LIBELLES_HABILITATION,
  RANG_HABILITATION,
} from '@/types/messaf';
import type { Poste } from '@/types/position';
import { schemaHabilitation, type ValeursHabilitation } from '@/validation/agent.schemas';
import { ActionsEtape, type PropsEtape } from './commun';

interface Props extends PropsEtape<ValeursHabilitation> {
  poste?: Poste;
}

export function EtapeHabilitation({ valeurs, suivant, precedent, poste }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ValeursHabilitation>({
    resolver: zodResolver(schemaHabilitation),
    // Proposition par défaut : le niveau requis par le poste.
    defaultValues: valeurs ?? (poste ? { habilitation: poste.habilitationRequise } : {}),
  });
  const choisie = useWatch({ control, name: 'habilitation' });
  const requise = poste?.habilitationRequise;
  const ecart = choisie && requise ? RANG_HABILITATION[choisie] - RANG_HABILITATION[requise] : 0;

  return (
    <form onSubmit={handleSubmit(suivant)} noValidate>
      <Alerte ton="info" className="mt" titre="Décision finale côté serveur">
        Ce choix est une demande. Keycloak et l'API d'administration appliquent les règles réelles d'habilitation et
        peuvent refuser un niveau non conforme au poste ou à l'organisation.
      </Alerte>

      <fieldset className="bloc-objet mt" style={{ margin: '16px 0 0' }} aria-describedby={errors.habilitation ? 'erreur-habilitation' : undefined}>
        <legend className="visually-hidden">Niveau d'habilitation</legend>
        <h3 className="bloc-objet-titre">Niveau d'habilitation</h3>
        <p className="bloc-objet-sous-titre">
          {poste ? (
            <>
              Le poste <span className="mono">{poste.code}</span> requiert le niveau{' '}
              <strong>{LIBELLES_HABILITATION[poste.habilitationRequise]}</strong>.
            </>
          ) : (
            "Niveau d'accès aux messages classifiés."
          )}
        </p>
        <div className="choix-habilitation" role="radiogroup">
          {HABILITATIONS.map((h) => (
            <label key={h} className="option-habilitation">
              <input type="radio" value={h} {...register('habilitation')} />
              <span>
                <span className="option-habilitation-titre">
                  {LIBELLES_HABILITATION[h]}
                  <code className="badge badge-neutre">{h}</code>
                  {h === requise && <span className="badge badge-vert">Requis par le poste</span>}
                </span>
                <span className="option-habilitation-description" style={{ display: 'block' }}>
                  {DESCRIPTIONS_HABILITATION[h]}
                </span>
              </span>
            </label>
          ))}
        </div>
        {errors.habilitation && (
          <p className="champ-erreur mt" id="erreur-habilitation">
            <CircleAlert size={14} aria-hidden />
            {errors.habilitation.message}
          </p>
        )}
      </fieldset>

      {ecart > 0 && (
        <Alerte ton="attention" className="mt" titre="Niveau supérieur à celui du poste">
          Le niveau choisi dépasse celui requis par le poste. Il devra être justifié et pourra être refusé par le
          serveur.
        </Alerte>
      )}
      {ecart < 0 && (
        <Alerte ton="attention" className="mt" titre="Niveau inférieur à celui du poste">
          L'agent ne pourra pas recevoir certains messages classifiés destinés à ce poste.
        </Alerte>
      )}

      <ActionsEtape precedent={precedent}>
        <button type="submit" className="btn btn-primaire">
          Voir le récapitulatif
          <ChevronRight size={17} aria-hidden />
        </button>
      </ActionsEtape>
    </form>
  );
}
