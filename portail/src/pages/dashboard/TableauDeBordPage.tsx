import { ChevronRight, CircleCheck, RotateCcw, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeEtat } from '@/components/ui/Badges';
import { Chargeur } from '@/components/ui/Chargeur';
import { ErreurChargement } from '@/components/ui/ErreurChargement';
import { Etoile } from '@/components/ui/Marque';
import { Modale } from '@/components/ui/Modale';
import { useSession } from '@/contexts/AuthContext';
import { useReferentielRH } from '@/contexts/ReferentielContext';
import { useAgents } from '@/hooks/useAgents';
import { agentsService } from '@/services/agents.service';
import { formaterDateHeure, nomComplet } from '@/utils/format';

export function TableauDeBordPage() {
  const session = useSession();
  const { referentiel } = useReferentielRH();
  const { donnees: agents, erreur, chargement, recharger } = useAgents();
  const [confirmerReinit, setConfirmerReinit] = useState(false);
  const simulation = agentsService.simulation;

  const actifs = agents?.filter((a) => a.etat === 'actif').length;
  const creesSession = agents?.filter((a) => a.creeLe && a.creeLe >= session.ouverteLe).length ?? 0;
  const derniers = agents?.slice(0, 5) ?? [];

  const reinitialiser = () => {
    agentsService.reinitialiserDemonstration?.();
    setConfirmerReinit(false);
    recharger();
  };

  return (
    <>
      <div className="page-entete">
        <div>
          <h1>Bonjour, {session.nomComplet.split(' ')[0]}</h1>
          <p>Enrôlement des agents — {referentiel?.libelle(session.ministere) ?? session.ministere}</p>
        </div>
        <Link to="/agents/nouveau" className="btn btn-primaire btn-grand">
          <UserPlus size={18} aria-hidden />
          Enregistrer un nouvel agent
        </Link>
      </div>

      {erreur ? (
        <ErreurChargement erreur={erreur} recharger={recharger} />
      ) : (
        <>
          <section className="statistiques" aria-label="Indicateurs">
            <div className="carte stat">
              <span className="stat-label">
                <Users size={16} aria-hidden />
                Agents enregistrés
              </span>
              <span className="stat-valeur">{chargement ? '…' : agents?.length}</span>
              <span className="stat-note">{simulation ? 'Jeu de données fictif' : 'Dans votre périmètre'}</span>
            </div>
            <div className="carte stat">
              <span className="stat-label">
                <CircleCheck size={16} aria-hidden />
                Comptes actifs
              </span>
              <span className="stat-valeur">{chargement ? '…' : actifs}</span>
              <span className="stat-note">Attribut Keycloak etat = actif</span>
            </div>
            <div className="carte stat">
              <span className="stat-label">
                <UserPlus size={16} aria-hidden />
                Créations pendant cette session
              </span>
              <span className="stat-valeur">{chargement ? '…' : creesSession}</span>
              <span className="stat-note">{simulation ? 'Créations simulées' : 'Depuis votre connexion'}</span>
            </div>
          </section>

          <div className="grille-tdb">
            <section className="carte">
              <div className="carte-entete">
                <h2>Derniers agents ajoutés</h2>
                <Link to="/agents" className="btn btn-fantome btn-petit">
                  Voir la liste
                  <ChevronRight size={15} aria-hidden />
                </Link>
              </div>
              {chargement ? (
                <Chargeur />
              ) : (
                <ul className="liste-simple">
                  {derniers.map((a) => (
                    <li key={a.identite.matricule}>
                      <Link to={`/agents/${a.identite.matricule}`} className="ligne-agent">
                        <span className="ligne-agent-texte">
                          <span className="ligne-agent-nom" style={{ display: 'block' }}>
                            {nomComplet(a.identite.nom, a.identite.prenoms)}
                          </span>
                          <span className="ligne-agent-detail" style={{ display: 'block' }}>
                            {a.identite.matricule} · {a.poste?.intitule ?? a.affectation?.poste ?? '—'} ·{' '}
                            {formaterDateHeure(a.creeLe)}
                          </span>
                        </span>
                        {a.creeLe && a.creeLe >= session.ouverteLe && <span className="badge badge-bleu">Nouveau</span>}
                        <BadgeEtat valeur={a.etat} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div style={{ display: 'grid', gap: 16 }}>
              <section className="appel-action">
                <Etoile />
                <h2>Enrôler un agent</h2>
                <p>
                  Identité, profil professionnel, poste et affectation, habilitation : cinq étapes, puis la fiche
                  d'enrôlement à remettre à l'agent.
                </p>
                <Link to="/agents/nouveau" className="btn btn-primaire">
                  <UserPlus size={16} aria-hidden />
                  Commencer
                </Link>
              </section>

              {simulation && (
                <section className="carte carte-corps" style={{ display: 'grid', gap: 10 }}>
                  <h2 style={{ fontSize: 15 }}>Données de démonstration</h2>
                  <p style={{ fontSize: 13.5, color: 'var(--texte-doux)' }}>
                    Les agents créés pendant les essais sont gardés dans ce navigateur. Les comptes du jeu commun
                    (100001 à 100011) restent toujours présents.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondaire btn-petit"
                    style={{ justifySelf: 'start' }}
                    onClick={() => setConfirmerReinit(true)}
                  >
                    <RotateCcw size={14} aria-hidden />
                    Effacer les agents créés en démonstration
                  </button>
                </section>
              )}
            </div>
          </div>
        </>
      )}

      <Modale
        ouverte={confirmerReinit}
        titre="Effacer les créations de démonstration ?"
        fermer={() => setConfirmerReinit(false)}
        actions={
          <>
            <button type="button" className="btn btn-secondaire" onClick={() => setConfirmerReinit(false)} data-autofocus>
              Annuler
            </button>
            <button type="button" className="btn btn-primaire" onClick={reinitialiser}>
              Effacer
            </button>
          </>
        }
      >
        <p>
          Les agents ajoutés pendant les essais seront retirés de ce navigateur. Le jeu de données fictif commun est
          conservé. Aucune donnée réelle n'est concernée.
        </p>
      </Modale>
    </>
  );
}
