import { CircleCheck, Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ResumeAgent, type SectionAgent } from '@/components/agents/ResumeAgent';
import { Alerte } from '@/components/ui/Alerte';
import { IconeChargement } from '@/components/ui/Chargeur';
import { Modale } from '@/components/ui/Modale';
import type { Referentiel } from '@/hooks/useReferentiel';
import { agentsService } from '@/services/agents.service';
import { ApiError, messageErreur } from '@/services/errors';
import type { Agent, NouvelAgent, ResultatCreationAgent } from '@/types/agent';
import { construireMatrixId } from '@/utils/matrix';
import { nomComplet } from '@/utils/format';
import { ActionsEtape } from './commun';

interface Props {
  nouvelAgent: NouvelAgent;
  referentiel: Referentiel;
  modifier: (section: SectionAgent) => void;
  precedent: () => void;
  cree: (resultat: ResultatCreationAgent) => void;
}

export function EtapeRecapitulatif({ nouvelAgent, referentiel, modifier, precedent, cree }: Props) {
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>();
  // Verrou synchrone : un double clic ne peut pas déclencher deux créations.
  const verrou = useRef(false);

  const matricule = nouvelAgent.identite.matricule;
  const apercu: Agent = {
    identite: nouvelAgent.identite,
    profil: nouvelAgent.profil,
    habilitation: nouvelAgent.habilitation,
    matrixId: construireMatrixId(matricule),
    affectation: { matricule, ...nouvelAgent.affectation },
    poste: referentiel.poste(nouvelAgent.affectation.poste),
  };

  const creer = async () => {
    if (verrou.current) return;
    verrou.current = true;
    setEnvoi(true);
    setErreur(undefined);
    try {
      const resultat = await agentsService.creer(nouvelAgent);
      cree(resultat);
    } catch (e) {
      setErreur(e);
      setConfirmation(false);
      verrou.current = false;
      setEnvoi(false);
    }
  };

  const zoneErreur = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (erreur !== undefined) zoneErreur.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [erreur]);

  const doublon = erreur instanceof ApiError && erreur.status === 409;

  return (
    <div>
      <Alerte ton="info" className="mt">
        Vérifiez chaque bloc. Les quatre objets restent distincts : l'identité est créée une fois pour toutes, le poste
        et l'affectation pourront évoluer sans la modifier.
      </Alerte>

      {erreur !== undefined && (
        <div ref={zoneErreur}>
          <Alerte ton="erreur" className="mt" titre={doublon ? 'Matricule déjà utilisé' : 'La création a échoué'}>
            <p>{messageErreur(erreur)}</p>
            {doublon && (
              <button type="button" className="btn btn-secondaire btn-petit" style={{ marginTop: 10 }} onClick={() => modifier('identite')}>
                <Pencil size={14} aria-hidden />
                Corriger le matricule
              </button>
            )}
          </Alerte>
        </div>
      )}

      <div className="mt">
        <ResumeAgent agent={apercu} referentiel={referentiel} modifier={modifier} afficherEtat={false} />
      </div>

      <ActionsEtape precedent={precedent}>
        <button type="button" className="btn btn-primaire btn-grand" onClick={() => setConfirmation(true)} disabled={envoi}>
          <CircleCheck size={18} aria-hidden />
          Créer l'agent
        </button>
      </ActionsEtape>

      <Modale
        ouverte={confirmation}
        titre="Confirmer la création de l'agent"
        fermer={() => setConfirmation(false)}
        bloquee={envoi}
        actions={
          <>
            <button type="button" className="btn btn-secondaire" onClick={() => setConfirmation(false)} disabled={envoi} data-autofocus>
              Annuler
            </button>
            <button type="button" className="btn btn-primaire" onClick={creer} disabled={envoi}>
              {envoi ? <IconeChargement /> : <CircleCheck size={17} aria-hidden />}
              {envoi ? 'Création en cours…' : 'Confirmer la création'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <p>
            Vous allez enregistrer <strong>{nomComplet(nouvelAgent.identite.nom, nouvelAgent.identite.prenoms)}</strong>{' '}
            (matricule <span className="mono">{matricule}</span>) avec l'identifiant{' '}
            <span className="matrix-id">{apercu.matrixId}</span>.
          </p>
          {agentsService.simulation ? (
            <Alerte ton="demo">Création simulée : aucun compte ne sera créé dans Keycloak ni dans Synapse.</Alerte>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--texte-doux)' }}>
              La demande sera envoyée à l'API d'administration, qui vérifiera vos droits sur ce ministère.
            </p>
          )}
        </div>
      </Modale>
    </div>
  );
}
