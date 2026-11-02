import { Check, CircleCheck, Copy, List, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { FicheEnrolement } from '@/components/agents/FicheEnrolement';
import { Alerte } from '@/components/ui/Alerte';
import { BadgeHabilitation } from '@/components/ui/Badges';
import { Chargeur } from '@/components/ui/Chargeur';
import { ErreurChargement } from '@/components/ui/ErreurChargement';
import { useReferentielRH } from '@/contexts/ReferentielContext';
import { useAgent } from '@/hooks/useAgents';
import { agentsService } from '@/services/agents.service';
import type { Agent, ResultatCreationAgent } from '@/types/agent';
import { formaterDate, nomComplet } from '@/utils/format';

function BoutonCopier({ texte }: { texte: string }) {
  const [copie, setCopie] = useState(false);
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      /* presse-papiers indisponible : l'identifiant reste lisible à l'écran */
    }
  };
  return (
    <button type="button" className="btn btn-secondaire btn-petit" onClick={copier}>
      {copie ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {copie ? 'Copié' : "Copier l'identifiant"}
    </button>
  );
}

function Contenu({ agent, simulee }: { agent: Agent; simulee: boolean }) {
  const { referentiel } = useReferentielRH();
  const poste = agent.poste ?? referentiel?.poste(agent.affectation?.poste);
  const libelle = (code?: string) => referentiel?.libelle(code) ?? code ?? '—';

  return (
    <div className="grille-detail">
      <section className="carte">
        <div className="succes-entete">
          <span className="succes-icone">
            <CircleCheck size={28} aria-hidden />
          </span>
          <div>
            <h1 style={{ fontSize: 21 }}>{simulee ? 'Création simulée réussie' : 'Agent créé'}</h1>
            <p style={{ color: 'var(--texte-doux)' }}>
              {nomComplet(agent.identite.nom, agent.identite.prenoms)} est enregistré dans MESSAF-BF
              {simulee ? ' (démonstration)' : ''}.
            </p>
          </div>
        </div>
        <div className="carte-corps" style={{ display: 'grid', gap: 18 }}>
          {simulee && (
            <Alerte ton="demo" titre="Aucun compte réel n'a été créé">
              Cette création est simulée dans le navigateur : rien n'a été enregistré dans Keycloak, Synapse ou la base
              de l'API.
            </Alerte>
          )}

          <div className="identifiant-encadre">
            <div>
              <div className="identifiant-encadre-label">Identifiant Matrix</div>
              <div className="identifiant-encadre-valeur">{agent.matrixId}</div>
            </div>
            <BoutonCopier texte={agent.matrixId} />
          </div>

          <dl className="donnees">
            <div className="donnees-item">
              <dt>Matricule</dt>
              <dd className="mono">{agent.identite.matricule}</dd>
            </div>
            <div className="donnees-item">
              <dt>Nom complet</dt>
              <dd>{nomComplet(agent.identite.nom, agent.identite.prenoms)}</dd>
            </div>
            <div className="donnees-item">
              <dt>Ministère</dt>
              <dd>{libelle(agent.profil.ministere)}</dd>
            </div>
            <div className="donnees-item">
              <dt>Direction</dt>
              <dd>{libelle(agent.profil.direction)}</dd>
            </div>
            <div className="donnees-item">
              <dt>Service</dt>
              <dd>{libelle(agent.profil.service)}</dd>
            </div>
            <div className="donnees-item">
              <dt>Poste</dt>
              <dd>
                {poste?.intitule} <span className="mono cellule-secondaire">({agent.affectation?.poste})</span>
              </dd>
            </div>
            <div className="donnees-item">
              <dt>Début d'affectation</dt>
              <dd>{formaterDate(agent.affectation?.dateDebut)}</dd>
            </div>
            <div className="donnees-item">
              <dt>Habilitation</dt>
              <dd>
                <BadgeHabilitation valeur={agent.habilitation} technique />
              </dd>
            </div>
          </dl>
        </div>
        <div className="carte-pied" style={{ flexWrap: 'wrap' }}>
          <Link to="/agents" className="btn btn-secondaire">
            <List size={16} aria-hidden />
            Retour à la liste des agents
          </Link>
          <Link to="/agents/nouveau" className="btn btn-primaire">
            <UserPlus size={16} aria-hidden />
            Créer un autre agent
          </Link>
        </div>
      </section>

      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <FicheEnrolement matricule={agent.identite.matricule} />
        <Alerte ton="info" titre="Étape suivante pour l'agent">
          Remettez la fiche à l'agent. À sa première connexion, il saisira son code d'activation, configurera son second
          facteur et confirmera ses informations professionnelles.
        </Alerte>
      </div>
    </div>
  );
}

/** Repli quand la page est rechargée : l'agent est relu depuis le service. */
function ContenuRecharge({ matricule }: { matricule: string }) {
  const { donnees, erreur, chargement, recharger } = useAgent(matricule);
  if (chargement) return <Chargeur />;
  if (erreur || !donnees) return <ErreurChargement erreur={erreur} recharger={recharger} />;
  return <Contenu agent={donnees} simulee={agentsService.simulation} />;
}

export function ConfirmationCreationPage() {
  const { matricule = '' } = useParams();
  const resultat = (useLocation().state as { resultat?: ResultatCreationAgent } | null)?.resultat;
  return resultat ? <Contenu agent={resultat.agent} simulee={resultat.simulee} /> : <ContenuRecharge matricule={matricule} />;
}
