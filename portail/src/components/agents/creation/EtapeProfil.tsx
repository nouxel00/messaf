import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Champ } from '@/components/forms/Champ';
import type { Referentiel } from '@/hooks/useReferentiel';
import { schemaProfil, type ValeursProfil } from '@/validation/agent.schemas';
import { ActionsEtape, type PropsEtape } from './commun';

interface Props extends PropsEtape<ValeursProfil> {
  referentiel: Referentiel;
  /** Ministère du responsable connecté : seul ministère où il peut enrôler. */
  ministerePerimetre: string;
}

export function EtapeProfil({ valeurs, suivant, precedent, referentiel, ministerePerimetre }: Props) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ValeursProfil>({
    resolver: zodResolver(schemaProfil),
    defaultValues: valeurs ?? {
      ministere: '',
      direction: '',
      service: '',
      afficherEmail: true,
      afficherTelephone: false,
    },
    mode: 'onTouched',
  });

  const ministere = useWatch({ control, name: 'ministere' });
  const direction = useWatch({ control, name: 'direction' });

  // Champs dépendants : changer le niveau supérieur vide les niveaux inférieurs.
  const precedents = useRef({ ministere, direction });
  useEffect(() => {
    if (precedents.current.ministere !== ministere) {
      setValue('direction', '');
      setValue('service', '');
    } else if (precedents.current.direction !== direction) {
      setValue('service', '');
    }
    precedents.current = { ministere, direction };
  }, [ministere, direction, setValue]);

  const ministeres = referentiel.structures.filter((s) => s.type === 'ministere' && s.code === ministerePerimetre);
  const directions = ministere ? referentiel.enfants(ministere) : [];
  const services = direction ? referentiel.enfants(direction) : [];

  return (
    <form onSubmit={handleSubmit(suivant)} noValidate>
      <div className="bloc-objet">
        <h3 className="bloc-objet-titre">Rattachement administratif</h3>
        <p className="bloc-objet-sous-titre">
          Les structures proviennent de l'organigramme officiel ; elles ne peuvent pas être créées ici.
        </p>
        <div className="grille-champs">
          <Champ
            label="Ministère"
            requis
            erreur={errors.ministere?.message}
            aide="Vous ne pouvez enrôler des agents que dans votre propre ministère."
            className="plein"
          >
            <select className="select" {...register('ministere')}>
              <option value="">Sélectionnez le ministère</option>
              {ministeres.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.libelle}
                </option>
              ))}
            </select>
          </Champ>
          <Champ
            label="Direction"
            requis
            erreur={errors.direction?.message}
            aide={!ministere ? "Choisissez d'abord le ministère." : undefined}
          >
            <select className="select" disabled={!ministere} {...register('direction')}>
              <option value="">Sélectionnez la direction</option>
              {directions.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.libelle}
                  {d.sigle ? ` (${d.sigle})` : ''}
                </option>
              ))}
            </select>
          </Champ>
          <Champ
            label="Service"
            requis
            erreur={errors.service?.message}
            aide={!direction ? "Choisissez d'abord la direction." : undefined}
          >
            <select className="select" disabled={!direction} {...register('service')}>
              <option value="">Sélectionnez le service</option>
              {services.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.libelle}
                </option>
              ))}
            </select>
          </Champ>
        </div>
      </div>

      <div className="bloc-objet">
        <h3 className="bloc-objet-titre">Informations visibles dans l'annuaire</h3>
        <p className="bloc-objet-sous-titre">
          Le nom, le poste et la structure apparaissent toujours dans l'annuaire MESSAF. Choisissez les coordonnées
          professionnelles à y ajouter.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          <label className="case">
            <input type="checkbox" {...register('afficherEmail')} />
            <span>Afficher le courriel professionnel</span>
          </label>
          <label className="case">
            <input type="checkbox" {...register('afficherTelephone')} />
            <span>Afficher le téléphone professionnel</span>
          </label>
        </div>
      </div>

      <ActionsEtape precedent={precedent}>
        <button type="submit" className="btn btn-primaire">
          Continuer
          <ChevronRight size={17} aria-hidden />
        </button>
      </ActionsEtape>
    </form>
  );
}
