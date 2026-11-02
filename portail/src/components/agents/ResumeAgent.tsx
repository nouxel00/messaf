import { Briefcase, CalendarDays, IdCard, KeyRound, Pencil, Building } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Referentiel } from '@/hooks/useReferentiel';
import type { Agent } from '@/types/agent';
import { formaterDate } from '@/utils/format';
import { BadgeEtat, BadgeHabilitation } from '../ui/Badges';

export type SectionAgent = 'identite' | 'profil' | 'poste' | 'habilitation';

interface Props {
  agent: Agent;
  referentiel?: Referentiel;
  /** Si fourni, chaque bloc affiche un bouton « Modifier » (récapitulatif). */
  modifier?: (section: SectionAgent) => void;
  /** Afficher l'état du compte (inconnu avant la création). */
  afficherEtat?: boolean;
}

function Bloc({
  icone: Icone,
  titre,
  sousTitre,
  action,
  children,
}: {
  icone: LucideIcon;
  titre: string;
  sousTitre: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bloc-objet recap-section">
      <div className="recap-entete">
        <div>
          <h3 className="bloc-objet-titre">
            <Icone size={18} aria-hidden />
            {titre}
          </h3>
          <p className="bloc-objet-sous-titre" style={{ marginBottom: 0 }}>
            {sousTitre}
          </p>
        </div>
        {action}
      </div>
      <dl className="donnees">{children}</dl>
    </section>
  );
}

function Donnee({ terme, children, plein }: { terme: string; children: ReactNode; plein?: boolean }) {
  return (
    <div className={`donnees-item ${plein ? 'plein' : ''}`}>
      <dt>{terme}</dt>
      <dd>{children || '—'}</dd>
    </div>
  );
}

/**
 * Présentation des quatre objets du modèle MESSAF — identité, profil, poste, affectation —
 * plus les attributs du compte. Utilisée par la fiche détaillée, le récapitulatif et la confirmation.
 */
export function ResumeAgent({ agent, referentiel, modifier, afficherEtat = true }: Props) {
  const { identite, profil, affectation } = agent;
  const poste = agent.poste ?? referentiel?.poste(affectation?.poste);
  const libelle = (code?: string) => referentiel?.libelle(code) ?? code ?? '—';
  const superieur = poste?.posteSuperieur ? referentiel?.poste(poste.posteSuperieur) : undefined;

  const boutonModifier = (section: SectionAgent, nom: string) =>
    modifier && (
      <button type="button" className="btn btn-fantome btn-petit" onClick={() => modifier(section)} aria-label={`Modifier : ${nom}`}>
        <Pencil size={14} aria-hidden />
        Modifier
      </button>
    );

  return (
    <div>
      <Bloc
        icone={IdCard}
        titre="Identité"
        sousTitre="La personne physique — conservée à vie, même en cas de changement de poste (Keycloak)"
        action={boutonModifier('identite', 'identité')}
      >
        <Donnee terme="Matricule">
          <span className="mono">{identite.matricule}</span>
        </Donnee>
        <Donnee terme="Nom">{identite.nom.toUpperCase()}</Donnee>
        <Donnee terme="Prénoms">{identite.prenoms}</Donnee>
        <Donnee terme="Courriel professionnel">{identite.coordonnees.email}</Donnee>
        <Donnee terme="Téléphone professionnel">{identite.coordonnees.telephone}</Donnee>
      </Bloc>

      <Bloc
        icone={Building}
        titre="Profil professionnel"
        sousTitre="Environnement administratif — attributs Keycloak ministere, direction, service"
        action={boutonModifier('profil', 'profil professionnel')}
      >
        <Donnee terme="Ministère">{libelle(profil.ministere)}</Donnee>
        <Donnee terme="Direction">{libelle(profil.direction)}</Donnee>
        <Donnee terme="Service">{libelle(profil.service)}</Donnee>
        <Donnee terme="Visible dans l'annuaire">
          {[profil.annuaire.afficherEmail && 'courriel', profil.annuaire.afficherTelephone && 'téléphone']
            .filter(Boolean)
            .join(' et ') || 'Nom, poste et structure uniquement'}
        </Donnee>
      </Bloc>

      <Bloc
        icone={Briefcase}
        titre="Poste"
        sousTitre="La fonction occupée dans l'organisation (base de l'API)"
        action={boutonModifier('poste', 'poste et affectation')}
      >
        <Donnee terme="Intitulé">{poste?.intitule}</Donnee>
        <Donnee terme="Code du poste">
          <span className="mono">{poste?.code ?? affectation?.poste}</span>
        </Donnee>
        <Donnee terme="Structure de rattachement">{libelle(poste?.structure)}</Donnee>
        <Donnee terme="Poste supérieur">
          {poste?.posteSuperieur ? `${superieur?.intitule ?? ''} (${poste.posteSuperieur})`.trim() : 'Aucun'}
        </Donnee>
        <Donnee terme="Habilitation requise par le poste">
          {poste && <BadgeHabilitation valeur={poste.habilitationRequise} />}
        </Donnee>
      </Bloc>

      <Bloc
        icone={CalendarDays}
        titre="Affectation"
        sousTitre="Rattachement daté de l'identité au poste (base de l'API)"
        action={boutonModifier('poste', 'affectation')}
      >
        <Donnee terme="Identité concernée">
          <span className="mono">{identite.matricule}</span>
        </Donnee>
        <Donnee terme="Poste concerné">
          <span className="mono">{affectation?.poste}</span>
        </Donnee>
        <Donnee terme="Date de début">{formaterDate(affectation?.dateDebut)}</Donnee>
        <Donnee terme="Date de fin">{affectation?.dateFin ? formaterDate(affectation.dateFin) : 'Non définie'}</Donnee>
      </Bloc>

      <Bloc
        icone={KeyRound}
        titre="Compte MESSAF"
        sousTitre="Identifiant de messagerie et attributs de sécurité (Keycloak)"
        action={boutonModifier('habilitation', 'habilitation')}
      >
        <Donnee terme="Identifiant Matrix">
          <span className="matrix-id">{agent.matrixId}</span>
        </Donnee>
        <Donnee terme="Habilitation">
          <BadgeHabilitation valeur={agent.habilitation} technique />
        </Donnee>
        {afficherEtat && (
          <Donnee terme="État du compte">
            <BadgeEtat valeur={agent.etat} />
          </Donnee>
        )}
      </Bloc>
    </div>
  );
}
