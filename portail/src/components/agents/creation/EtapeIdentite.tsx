import { zodResolver } from '@hookform/resolvers/zod';
import { AtSign, ChevronRight } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Champ } from '@/components/forms/Champ';
import { Alerte } from '@/components/ui/Alerte';
import { IconeChargement } from '@/components/ui/Chargeur';
import { DESCRIPTION_FORMAT_MATRICULE, DOMAINE_MATRIX } from '@/config/messaf';
import { agentsService } from '@/services/agents.service';
import { messageErreur } from '@/services/errors';
import { apercuMatrixId } from '@/utils/matrix';
import { schemaIdentite, type ValeursIdentite } from '@/validation/agent.schemas';
import { useState } from 'react';
import { ActionsEtape, type PropsEtape } from './commun';

const vide: ValeursIdentite = { matricule: '', nom: '', prenoms: '', email: '', telephone: '' };

export function EtapeIdentite({ valeurs, suivant }: PropsEtape<ValeursIdentite>) {
  const [erreurVerification, setErreurVerification] = useState<string>();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ValeursIdentite>({
    resolver: zodResolver(schemaIdentite),
    defaultValues: valeurs ?? vide,
    mode: 'onTouched',
  });
  const matricule = useWatch({ control, name: 'matricule' });
  const apercu = apercuMatrixId(matricule ?? '');

  const soumettre = handleSubmit(async (v) => {
    setErreurVerification(undefined);
    try {
      const disponible = await agentsService.matriculeDisponible(v.matricule);
      if (disponible === false) {
        setError('matricule', { message: 'Ce matricule est déjà utilisé par un agent enregistré.' }, { shouldFocus: true });
        return;
      }
      suivant(v);
    } catch (e) {
      setErreurVerification(messageErreur(e));
    }
  });

  return (
    <form onSubmit={soumettre} noValidate>
      <div className="bloc-objet">
        <h3 className="bloc-objet-titre">Personne physique</h3>
        <p className="bloc-objet-sous-titre">
          L'identité ne change jamais : un changement de poste crée une nouvelle affectation, pas une nouvelle identité.
        </p>
        <div className="grille-champs">
          <Champ
            label="Matricule"
            requis
            erreur={errors.matricule?.message}
            aide={`Matricule de l'agent dans l'administration : ${DESCRIPTION_FORMAT_MATRICULE}.`}
            className="plein"
          >
            <input className="input mono" inputMode="numeric" autoComplete="off" maxLength={12} {...register('matricule')} />
          </Champ>
          <div className={`apercu-matrix plein ${apercu ? 'valide' : ''}`} aria-live="polite">
            <AtSign size={16} aria-hidden />
            <span>Identifiant Matrix généré :</span>
            {apercu ? (
              <span className="apercu-matrix-valeur">{apercu}</span>
            ) : (
              <span className="apercu-matrix-vide">
                @m&lt;matricule&gt;:{DOMAINE_MATRIX} — saisissez un matricule valide
              </span>
            )}
          </div>
          <Champ label="Nom" requis erreur={errors.nom?.message}>
            <input className="input" autoComplete="off" {...register('nom')} />
          </Champ>
          <Champ label="Prénoms" requis erreur={errors.prenoms?.message}>
            <input className="input" autoComplete="off" {...register('prenoms')} />
          </Champ>
        </div>
      </div>

      <div className="bloc-objet">
        <h3 className="bloc-objet-titre">Coordonnées professionnelles</h3>
        <p className="bloc-objet-sous-titre">Uniquement des coordonnées de service, jamais personnelles.</p>
        <div className="grille-champs">
          <Champ label="Courriel professionnel" requis erreur={errors.email?.message}>
            <input className="input" type="email" autoComplete="off" {...register('email')} />
          </Champ>
          <Champ label="Téléphone professionnel" erreur={errors.telephone?.message} aide="Format : +226 70 00 00 00">
            <input className="input" type="tel" autoComplete="off" {...register('telephone')} />
          </Champ>
        </div>
      </div>

      {erreurVerification && (
        <Alerte ton="erreur" titre="Vérification du matricule impossible" className="mt">
          {erreurVerification}
        </Alerte>
      )}
      {!agentsService.simulation && (
        <Alerte ton="info" className="mt">
          L'unicité du matricule sera vérifiée par le serveur au moment de la création.
        </Alerte>
      )}

      <ActionsEtape>
        <button type="submit" className="btn btn-primaire" disabled={isSubmitting}>
          {isSubmitting ? <IconeChargement /> : null}
          {isSubmitting ? 'Vérification du matricule…' : 'Continuer'}
          {!isSubmitting && <ChevronRight size={17} aria-hidden />}
        </button>
      </ActionsEtape>
    </form>
  );
}
