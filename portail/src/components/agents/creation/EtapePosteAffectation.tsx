import { zodResolver } from '@hookform/resolvers/zod';
import { Briefcase, CalendarDays, ChevronRight } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Champ } from '@/components/forms/Champ';
import { Alerte } from '@/components/ui/Alerte';
import { BadgeHabilitation } from '@/components/ui/Badges';
import type { Referentiel } from '@/hooks/useReferentiel';
import { aujourdhui } from '@/utils/format';
import type { ValeursProfil } from '@/validation/agent.schemas';
import { schemaPosteAffectation, type ValeursPosteAffectation } from '@/validation/agent.schemas';
import { ActionsEtape, type PropsEtape } from './commun';

interface Props extends PropsEtape<ValeursPosteAffectation> {
  referentiel: Referentiel;
  profil: ValeursProfil;
  matricule: string;
}

export function EtapePosteAffectation({ valeurs, suivant, precedent, referentiel, profil, matricule }: Props) {
  // Postes rattachés au service choisi ou à sa direction.
  const postes = referentiel.postes.filter((p) => p.structure === profil.service || p.structure === profil.direction);
  const posteValide = valeurs && postes.some((p) => p.code === valeurs.poste);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ValeursPosteAffectation>({
    resolver: zodResolver(schemaPosteAffectation),
    defaultValues: {
      poste: posteValide ? valeurs.poste : '',
      dateDebut: valeurs?.dateDebut ?? aujourdhui(),
      dateFin: valeurs?.dateFin ?? '',
    },
    mode: 'onTouched',
  });
  const code = useWatch({ control, name: 'poste' });
  const dateDebut = useWatch({ control, name: 'dateDebut' });
  const poste = referentiel.poste(code);
  const superieur = referentiel.poste(poste?.posteSuperieur);

  return (
    <form onSubmit={handleSubmit(suivant)} noValidate>
      {valeurs && !posteValide && (
        <Alerte ton="attention" className="mt" titre="Poste à choisir de nouveau">
          Le profil a changé : le poste précédemment choisi n'appartient plus à la direction ou au service sélectionnés.
        </Alerte>
      )}

      <div className="bloc-objet mt">
        <h3 className="bloc-objet-titre">
          <Briefcase size={18} aria-hidden />
          Poste
        </h3>
        <p className="bloc-objet-sous-titre">
          La fonction occupée, définie dans l'organigramme. Postes de « {referentiel.libelle(profil.service)} » et de
          sa direction.
        </p>
        <div className="grille-champs">
          <Champ label="Poste occupé" requis erreur={errors.poste?.message} className="plein">
            <select className="select" {...register('poste')}>
              <option value="">Sélectionnez le poste</option>
              {postes.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.intitule} — {p.code}
                </option>
              ))}
            </select>
          </Champ>
          {postes.length === 0 && (
            <Alerte ton="attention" className="plein">
              Aucun poste n'est défini pour cette structure. Revenez à l'étape précédente pour choisir un autre service.
            </Alerte>
          )}
        </div>
        {poste && (
          <dl className="donnees mt" style={{ paddingTop: 16, borderTop: '1px solid var(--bordure)' }}>
            <div className="donnees-item">
              <dt>Code du poste</dt>
              <dd className="mono">{poste.code}</dd>
            </div>
            <div className="donnees-item">
              <dt>Intitulé du poste</dt>
              <dd>{poste.intitule}</dd>
            </div>
            <div className="donnees-item">
              <dt>Structure de rattachement</dt>
              <dd>{referentiel.libelle(poste.structure)}</dd>
            </div>
            <div className="donnees-item">
              <dt>Poste supérieur</dt>
              <dd>{poste.posteSuperieur ? `${superieur?.intitule ?? ''} (${poste.posteSuperieur})` : 'Aucun'}</dd>
            </div>
            <div className="donnees-item">
              <dt>Habilitation requise</dt>
              <dd>
                <BadgeHabilitation valeur={poste.habilitationRequise} technique />
              </dd>
            </div>
          </dl>
        )}
      </div>

      <div className="bloc-objet">
        <h3 className="bloc-objet-titre">
          <CalendarDays size={18} aria-hidden />
          Affectation
        </h3>
        <p className="bloc-objet-sous-titre">
          Rattachement de l'identité <span className="mono">{matricule}</span> au poste choisi, pour une période donnée.
        </p>
        <div className="grille-champs">
          <Champ label="Date de début" requis erreur={errors.dateDebut?.message}>
            <input className="input" type="date" {...register('dateDebut')} />
          </Champ>
          <Champ
            label="Date de fin"
            erreur={errors.dateFin?.message}
            aide="À laisser vide si la fin n'est pas connue."
          >
            <input className="input" type="date" min={dateDebut || undefined} {...register('dateFin')} />
          </Champ>
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
