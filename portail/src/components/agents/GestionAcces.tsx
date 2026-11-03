import { RotateCcw, ShieldCheck, ShieldOff } from 'lucide-react';
import { useId, useState } from 'react';
import { useSession } from '@/contexts/AuthContext';
import { agentsService } from '@/services/agents.service';
import { ApiError, messageErreur } from '@/services/errors';
import type { Agent } from '@/types/agent';
import type { EtatCompte } from '@/types/messaf';
import { nomComplet } from '@/utils/format';
import { BadgeEtat } from '../ui/Badges';
import { Alerte } from '../ui/Alerte';
import { IconeChargement } from '../ui/Chargeur';
import { Modale } from '../ui/Modale';

const MOTIF_MIN = 5;
const MOTIF_MAX = 500;

type Action = 'revocation' | 'reactivation';

interface Props {
  agent: Agent;
  /** Appelée après une révocation ou une réactivation réussie. */
  changement: (etat: EtatCompte, message: string) => void;
}

/**
 * Révocation et réactivation de l'accès d'un agent (rôle admin_ministere).
 * POST /agents/{matricule}/revocation | /reactivation, avec un motif inscrit au journal d'audit.
 */
export function GestionAcces({ agent, changement }: Props) {
  const session = useSession();
  const [action, setAction] = useState<Action>();
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>();
  /** Révocation commencée mais MAS n'a pas répondu (503) : elle doit être relancée. */
  const [partielle, setPartielle] = useState(false);
  const idMotif = useId();

  const matricule = agent.identite.matricule;
  const nom = nomComplet(agent.identite.nom, agent.identite.prenoms);
  const revoque = agent.etat === 'revoque';
  const soiMeme = session.matricule === matricule || session.identifiant === matricule;
  const motifValide = motif.trim().length >= MOTIF_MIN;

  const ouvrir = (a: Action) => {
    setAction(a);
    setMotif('');
    setErreur(undefined);
  };
  const fermer = () => !envoi && setAction(undefined);

  const confirmer = async () => {
    if (!action || !motifValide || envoi) return;
    setEnvoi(true);
    setErreur(undefined);
    try {
      if (action === 'revocation') {
        const r = await agentsService.revoquer(matricule, motif.trim());
        setPartielle(false);
        const n = r.sessionsFermees;
        changement(
          r.etat,
          `Accès de ${nom} révoqué. ${n === 0 ? 'Aucune session n’était ouverte.' : `${n} session${n > 1 ? 's' : ''} fermée${n > 1 ? 's' : ''}.`}`,
        );
      } else {
        await agentsService.reactiver(matricule, motif.trim());
        changement('actif', `Accès de ${nom} rétabli. L’agent devra se reconnecter sur son téléphone.`);
      }
      setAction(undefined);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'revocation_partielle') {
        setPartielle(true);
        setAction(undefined);
        changement('revoque', '');
      }
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <section className="carte">
      <div className="carte-entete">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {revoque ? <ShieldOff size={18} aria-hidden /> : <ShieldCheck size={18} aria-hidden />}
          Accès à MESSAF
        </h2>
        <BadgeEtat valeur={agent.etat} />
      </div>
      <div className="carte-corps" style={{ display: 'grid', gap: 14 }}>
        {erreur !== undefined && action === undefined && (
          <Alerte ton="erreur" titre={partielle ? 'Révocation incomplète' : "L'opération a échoué"}>
            {messageErreur(erreur)}
          </Alerte>
        )}

        {soiMeme ? (
          <p style={{ fontSize: 14, color: 'var(--texte-doux)' }}>
            Vous ne pouvez pas révoquer votre propre compte : un autre administrateur doit le faire.
          </p>
        ) : revoque && !partielle ? (
          <>
            <p style={{ fontSize: 14, color: 'var(--texte-doux)' }}>
              Ce compte est révoqué : l'agent ne peut plus se connecter, et toutes ses sessions ont été fermées.
            </p>
            <button type="button" className="btn btn-secondaire" style={{ justifySelf: 'start' }} onClick={() => ouvrir('reactivation')}>
              <RotateCcw size={16} aria-hidden />
              Rétablir l'accès
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: 'var(--texte-doux)' }}>
              En cas de départ, de faute ou de téléphone perdu, la révocation coupe l'accès immédiatement :
            </p>
            <ul className="liste-effets">
              <li>connexion bloquée (Keycloak) ;</li>
              <li>compte verrouillé et toutes ses sessions fermées (MAS) ;</li>
              <li>sur son téléphone, l'application affiche « Device removed » en deux minutes au plus.</li>
            </ul>
            <button type="button" className="btn btn-danger" style={{ justifySelf: 'start' }} onClick={() => ouvrir('revocation')}>
              <ShieldOff size={16} aria-hidden />
              {partielle ? 'Relancer la révocation' : "Révoquer l'accès"}
            </button>
          </>
        )}
      </div>

      <Modale
        ouverte={action !== undefined}
        titre={action === 'revocation' ? `Révoquer l'accès de ${nom} ?` : `Rétablir l'accès de ${nom} ?`}
        fermer={fermer}
        bloquee={envoi}
        actions={
          <>
            <button type="button" className="btn btn-secondaire" onClick={fermer} disabled={envoi} data-autofocus>
              Annuler
            </button>
            <button
              type="button"
              className={`btn ${action === 'revocation' ? 'btn-danger' : 'btn-primaire'}`}
              onClick={confirmer}
              disabled={envoi || !motifValide}
            >
              {envoi && <IconeChargement />}
              {action === 'revocation' ? 'Confirmer la révocation' : 'Confirmer'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <p>
            {action === 'revocation'
              ? "L'effet est immédiat : l'agent ne pourra plus se connecter et ses appareils seront déconnectés."
              : "L'agent pourra se reconnecter avec son mot de passe et son code à 6 chiffres. Ses anciennes sessions restent fermées."}
          </p>
          {erreur !== undefined && (
            <Alerte ton="erreur">{messageErreur(erreur)}</Alerte>
          )}
          <div className="champ">
            <label className="champ-label" htmlFor={idMotif}>
              Motif <span aria-hidden>*</span>
            </label>
            <textarea
              id={idMotif}
              className="input textarea"
              value={motif}
              maxLength={MOTIF_MAX}
              placeholder={action === 'revocation' ? 'Ex. : fin de fonctions, téléphone perdu' : 'Ex. : nouveau téléphone remis'}
              onChange={(e) => setMotif(e.target.value)}
              aria-describedby={`${idMotif}-aide`}
              disabled={envoi}
            />
            <p className="champ-aide" id={`${idMotif}-aide`}>
              Inscrit au journal d'audit, avec votre nom et l'heure ({MOTIF_MIN} caractères au moins).
            </p>
          </div>
        </div>
      </Modale>
    </section>
  );
}
