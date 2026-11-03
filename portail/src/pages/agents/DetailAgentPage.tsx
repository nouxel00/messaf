import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FicheEnrolement } from '@/components/agents/FicheEnrolement';
import { GestionAcces } from '@/components/agents/GestionAcces';
import { ResumeAgent } from '@/components/agents/ResumeAgent';
import { Alerte } from '@/components/ui/Alerte';
import { Chargeur } from '@/components/ui/Chargeur';
import { ErreurChargement } from '@/components/ui/ErreurChargement';
import { useSession } from '@/contexts/AuthContext';
import { useReferentielRH } from '@/contexts/ReferentielContext';
import { useAgent } from '@/hooks/useAgents';
import type { EtatCompte } from '@/types/messaf';
import { nomComplet } from '@/utils/format';
import { peutEnroler, peutRevoquer } from '@/utils/permissions';

export function DetailAgentPage() {
  const { matricule = '' } = useParams();
  const session = useSession();
  const { referentiel } = useReferentielRH();
  const { donnees: lu, erreur, chargement, recharger } = useAgent(matricule);
  // État modifié par une révocation ou une réactivation, sans relire toute la fiche
  const [etat, setEtat] = useState<EtatCompte>();
  const [message, setMessage] = useState<string>();
  useEffect(() => {
    setEtat(undefined);
    setMessage(undefined);
  }, [matricule]);
  const agent = lu && etat ? { ...lu, etat } : lu;

  return (
    <>
      <nav className="fil" aria-label="Fil d'Ariane">
        <Link to="/agents">Agents</Link>
        <ChevronRight size={14} aria-hidden />
        <span>{matricule}</span>
      </nav>

      {chargement ? (
        <Chargeur libelle="Chargement de l'agent…" />
      ) : erreur || !agent ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <ErreurChargement erreur={erreur} recharger={recharger} />
          <Link to="/agents" className="btn btn-secondaire" style={{ justifySelf: 'start' }}>
            <ArrowLeft size={16} aria-hidden />
            Retour à la liste
          </Link>
        </div>
      ) : (
        <>
          <div className="page-entete">
            <div>
              <h1>{nomComplet(agent.identite.nom, agent.identite.prenoms)}</h1>
              <p>
                {agent.poste?.intitule ?? agent.affectation?.poste} · {referentiel?.libelle(agent.profil.direction)}
              </p>
            </div>
            <Link to="/agents" className="btn btn-secondaire">
              <ArrowLeft size={16} aria-hidden />
              Retour à la liste
            </Link>
          </div>
          {message && (
            <Alerte ton="succes" className="mt" titre="C'est fait">
              {message} L'action est inscrite au journal d'audit.
            </Alerte>
          )}
          <div className="grille-detail" style={message ? { marginTop: 16 } : undefined}>
            <ResumeAgent agent={agent} referentiel={referentiel} />
            <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
              {peutRevoquer(session) && (
                <GestionAcces
                  agent={agent}
                  changement={(nouvelEtat, texte) => {
                    setEtat(nouvelEtat);
                    setMessage(texte || undefined);
                  }}
                />
              )}
              {!peutEnroler(session) ? null : agent.etat === 'revoque' ? (
                <Alerte ton="attention" titre="Compte révoqué">
                  Aucune fiche d'enrôlement ne peut être émise pour un compte révoqué.
                </Alerte>
              ) : agent.enrolement === 'termine' ? (
                <Alerte ton="succes" titre="Compte activé">
                  L'agent a fait sa première connexion : la fiche d'enrôlement n'est plus disponible. S'il perd son
                  téléphone, il se connecte avec ses codes de secours.
                </Alerte>
              ) : (
                <FicheEnrolement matricule={agent.identite.matricule} />
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
