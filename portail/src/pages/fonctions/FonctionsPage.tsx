import { ArrowLeftRight, ArrowRight, CircleCheck, RefreshCw, RotateCcw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Champ } from '@/components/forms/Champ';
import { Alerte } from '@/components/ui/Alerte';
import { Chargeur, IconeChargement } from '@/components/ui/Chargeur';
import { ErreurChargement } from '@/components/ui/ErreurChargement';
import { EtatVide } from '@/components/ui/EtatVide';
import { Modale } from '@/components/ui/Modale';
import { useSession } from '@/contexts/AuthContext';
import { useReferentielRH } from '@/contexts/ReferentielContext';
import { useAsync } from '@/hooks/useAsync';
import { agentsService } from '@/services/agents.service';
import { ApiError, messageErreur } from '@/services/errors';
import { fonctionsService } from '@/services/fonctions.service';
import type { Agent } from '@/types/agent';
import { LIBELLES_STATUT_PASSATION, type Fonction, type Passation, type StatutPassation } from '@/types/fonction';
import { LIBELLES_HABILITATION, RANG_HABILITATION } from '@/types/messaf';
import { aujourdhui, formaterDate, nomComplet } from '@/utils/format';

const tonStatut: Record<StatutPassation, string> = {
  planifiee: 'badge-bleu',
  executee: 'badge-vert',
  echec: 'badge-rouge',
  annulee: 'badge-neutre',
};

function BadgePassation({ statut }: { statut: StatutPassation }) {
  return <span className={`badge ${tonStatut[statut]}`}>{LIBELLES_STATUT_PASSATION[statut]}</span>;
}

/** Ce que le bot a fait, salon par salon. */
function CompteRendu({ passation }: { passation: Passation }) {
  const cr = passation.compteRendu;
  if (passation.statut === 'planifiee') {
    return <p>Le bot exécutera la passation le {formaterDate(passation.dateEffet)}.</p>;
  }
  if (!cr) return null;
  return (
    <ul className="detail-audit">
      {cr.erreur && <li>Erreur : {cr.erreur}</li>}
      {cr.salons.map((s) => (
        <li key={s.nom}>
          <span className="mono">{s.nom}</span> : {s.erreur ? `échec (${s.erreur})` : `${s.entrantInvite ? 'successeur invité' : 'successeur non invité'}${s.sortantsRetires.length ? ', sortant retiré' : ''}`}
        </li>
      ))}
      {cr.anciensSalons.map((s) => (
        <li key={s.nom}>
          <span className="mono">{s.nom}</span> : {s.erreur ? `échec (${s.erreur})` : 'ancienne fonction, successeur retiré'}
        </li>
      ))}
      {passation.statut === 'executee' && (
        <li>{cr.dossierTransmis ? 'Dossier de passation remis au successeur.' : 'Dossier de passation non remis.'}</li>
      )}
    </ul>
  );
}

function FormulairePassation({ fonction, fermer, faite }: { fonction: Fonction; fermer: () => void; faite: () => void }) {
  const session = useSession();
  const { donnees: agents, chargement } = useAsync(() => agentsService.lister({ ministere: session.ministere }), [session.ministere]);
  const [entrant, setEntrant] = useState('');
  const [sortant, setSortant] = useState(fonction.titulaires[0]?.matricule ?? '');
  const [dateEffet, setDateEffet] = useState(aujourdhui());
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>();
  const [resultat, setResultat] = useState<Passation>();

  const requis = fonction.poste.habilitationRequise;
  const candidats = useMemo(
    () =>
      (agents ?? [])
        .filter((a) => a.etat !== 'revoque' && !fonction.titulaires.some((t) => t.matricule === a.identite.matricule))
        .sort((x, y) => x.identite.nom.localeCompare(y.identite.nom)),
    [agents, fonction.titulaires],
  );
  const habilite = (a: Agent) => RANG_HABILITATION[a.habilitation] >= RANG_HABILITATION[requis];
  const nbSalons = fonction.salons.length;
  const posteActuel = candidats.find((a) => a.identite.matricule === entrant)?.poste;

  const confirmer = async () => {
    setEnvoi(true);
    setErreur(undefined);
    try {
      const p = await fonctionsService.planifierPassation({
        poste: fonction.poste.code,
        entrant,
        sortant: fonction.titulaires.length > 1 ? sortant : undefined,
        dateEffet,
        motif: motif.trim() || undefined,
      });
      setResultat(p);
      faite();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modale
      ouverte
      titre={resultat ? 'Passation enregistrée' : `Passation de service : ${fonction.poste.intitule}`}
      fermer={fermer}
      bloquee={envoi}
      actions={
        resultat ? (
          <button type="button" className="btn btn-primaire" onClick={fermer} data-autofocus>
            Fermer
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-secondaire" onClick={fermer} disabled={envoi}>
              Annuler
            </button>
            <button type="button" className="btn btn-primaire" onClick={confirmer} disabled={envoi || !entrant || !dateEffet}>
              {envoi ? <IconeChargement /> : <ArrowLeftRight size={16} aria-hidden />}
              {envoi ? 'Le bot exécute…' : dateEffet <= aujourdhui() ? 'Exécuter la passation' : 'Planifier la passation'}
            </button>
          </>
        )
      }
    >
      {resultat ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <p>
            <strong>{resultat.entrant.nom}</strong> {resultat.sortant ? <>remplace <strong>{resultat.sortant.nom}</strong></> : 'prend la fonction'}{' '}
            — <BadgePassation statut={resultat.statut} />
          </p>
          <CompteRendu passation={resultat} />
          {resultat.statut === 'echec' && (
            <Alerte ton="erreur" titre="Le bot n'a pas tout exécuté">
              L'affectation n'a pas changé. Corrigez la cause, puis relancez la passation depuis l'historique.
            </Alerte>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <p style={{ color: 'var(--texte-doux)', fontSize: 14 }}>
            À la date d'effet, le bot invite le successeur dans {nbSalons} salon{nbSalons > 1 ? 's' : ''} de la fonction, avec
            leur historique chiffré, en retire le sortant et remet un dossier de passation (affaires en cours, messages sans
            réponse). L'identité de chacun ne change pas : seule l'affectation au poste change.
          </p>
          {erreur !== undefined && (
            <Alerte ton="erreur" titre="La passation a été refusée">
              <p>{messageErreur(erreur)}</p>
              {erreur instanceof ApiError && erreur.champs && (
                <ul style={{ margin: '6px 0 0 18px' }}>
                  {Object.values(erreur.champs).map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
            </Alerte>
          )}
          {fonction.titulaires.length > 1 ? (
            <Champ label="Sortant" requis>
              <select className="select" value={sortant} onChange={(e) => setSortant(e.target.value)}>
                {fonction.titulaires.map((t) => (
                  <option key={t.matricule} value={t.matricule}>
                    {t.nom} ({t.matricule})
                  </option>
                ))}
              </select>
            </Champ>
          ) : (
            <p>
              Sortant : <strong>{fonction.titulaires[0]?.nom ?? 'aucun (fonction vacante)'}</strong>
            </p>
          )}
          <Champ label="Successeur" requis aide={`Le poste exige l'habilitation « ${LIBELLES_HABILITATION[requis]} ».`}>
            <select className="select" value={entrant} onChange={(e) => setEntrant(e.target.value)} disabled={chargement}>
              <option value="">{chargement ? 'Chargement des agents…' : "Choisissez l'agent"}</option>
              {candidats.map((a) => (
                <option key={a.identite.matricule} value={a.identite.matricule} disabled={!habilite(a)}>
                  {nomComplet(a.identite.nom, a.identite.prenoms)} ({a.identite.matricule})
                  {habilite(a) ? '' : ' — habilitation insuffisante'}
                </option>
              ))}
            </select>
          </Champ>
          {posteActuel && (
            <Alerte ton="info">
              Mutation : le successeur quitte son poste actuel, <strong>{posteActuel.intitule}</strong> (
              <span className="mono">{posteActuel.code}</span>), et les salons de cette fonction. Ce poste devient vacant
              s'il n'a pas d'autre titulaire.
            </Alerte>
          )}
          <Champ label="Date d'effet" requis aide="Aujourd'hui : la passation est exécutée tout de suite.">
            <input className="input" type="date" min={aujourdhui()} value={dateEffet} onChange={(e) => setDateEffet(e.target.value)} />
          </Champ>
          <Champ label="Motif" aide="Inscrit au journal d'audit.">
            <input className="input" maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. : mutation, nomination" />
          </Champ>
        </div>
      )}
    </Modale>
  );
}

export function FonctionsPage() {
  const session = useSession();
  const { referentiel } = useReferentielRH();
  const fonctions = useAsync(() => fonctionsService.lister(session.ministere), [session.ministere]);
  const historique = useAsync(() => fonctionsService.passations(session.ministere), [session.ministere]);
  const [choisie, setChoisie] = useState<Fonction>();
  const [action, setAction] = useState<number>();
  const [erreurAction, setErreurAction] = useState<unknown>();

  const triees = useMemo(
    () => [...(fonctions.donnees ?? [])].sort((a, b) => b.salons.length - a.salons.length || a.poste.code.localeCompare(b.poste.code)),
    [fonctions.donnees],
  );
  const recharger = () => {
    fonctions.recharger();
    historique.recharger();
  };
  const agir = async (id: number, faire: (id: number) => Promise<Passation>) => {
    setAction(id);
    setErreurAction(undefined);
    try {
      await faire(id);
      recharger();
    } catch (e) {
      setErreurAction(e);
    } finally {
      setAction(undefined);
    }
  };

  return (
    <>
      <div className="page-entete">
        <div>
          <h1>Fonctions et passations</h1>
          <p>
            On écrit à une fonction, pas seulement à une personne : quand le titulaire change, le successeur reprend les
            salons de la fonction, leur historique et un dossier de passation
            {fonctionsService.simulation && ' · passations simulées'}.
          </p>
        </div>
        <button type="button" className="btn btn-secondaire" onClick={recharger}>
          <RefreshCw size={16} aria-hidden />
          Actualiser
        </button>
      </div>

      {fonctions.erreur ? (
        <ErreurChargement erreur={fonctions.erreur} recharger={fonctions.recharger} />
      ) : (
        <section className="carte">
          <div className="carte-entete">
            <h2>Fonctions du ministère</h2>
          </div>
          {fonctions.chargement ? (
            <Chargeur libelle="Chargement des fonctions…" />
          ) : (
            <div className="tableau-defilant">
              <table className="tableau tableau-statique">
                <thead>
                  <tr>
                    <th scope="col">Fonction</th>
                    <th scope="col">Titulaire</th>
                    <th scope="col">Intérim</th>
                    <th scope="col">Salons</th>
                    <th scope="col">
                      <span className="visually-hidden">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {triees.map((f) => (
                    <tr key={f.poste.code}>
                      <td>
                        <div className="cellule-principale">{f.poste.intitule}</div>
                        <div className="cellule-secondaire">
                          <span className="mono">{f.poste.code}</span> · {referentiel?.libelle(f.poste.structure) ?? f.poste.structure}
                        </div>
                      </td>
                      <td>{f.vacante ? <span className="badge badge-or">Vacante</span> : f.titulaires.map((t) => t.nom).join(', ')}</td>
                      <td>
                        {f.interimaires.length
                          ? f.interimaires.map((i) => `${i.nom} (jusqu'au ${formaterDate(i.jusquAu)})`).join(', ')
                          : '—'}
                      </td>
                      <td title={f.salons.map((s) => s.nom).join('\n')}>{f.salons.length || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className="btn btn-secondaire btn-petit" onClick={() => setChoisie(f)}>
                          <ArrowLeftRight size={14} aria-hidden />
                          Passation
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="carte mt">
        <div className="carte-entete">
          <h2>Historique des passations</h2>
        </div>
        {erreurAction !== undefined && (
          <div className="carte-corps">
            <Alerte ton="erreur">{messageErreur(erreurAction)}</Alerte>
          </div>
        )}
        {historique.chargement ? (
          <Chargeur />
        ) : historique.erreur ? (
          <div className="carte-corps">
            <ErreurChargement erreur={historique.erreur} recharger={historique.recharger} />
          </div>
        ) : !historique.donnees?.length ? (
          <EtatVide icone={ArrowLeftRight} titre="Aucune passation pour l'instant" />
        ) : (
          <div className="tableau-defilant">
            <table className="tableau tableau-statique">
              <thead>
                <tr>
                  <th scope="col">Date d'effet</th>
                  <th scope="col">Fonction</th>
                  <th scope="col">Passation</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Compte rendu du bot</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {historique.donnees.map((p) => (
                  <tr key={p.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formaterDate(p.dateEffet)}</td>
                    <td>
                      <div>{p.intitule}</div>
                      <div className="cellule-secondaire mono">{p.poste}</div>
                    </td>
                    <td>
                      {p.sortant?.nom ?? 'vacante'} <ArrowRight size={13} aria-label="remplacé par" /> {p.entrant.nom}
                      {p.motif && <div className="cellule-secondaire">{p.motif}</div>}
                    </td>
                    <td>
                      <BadgePassation statut={p.statut} />
                    </td>
                    <td>
                      <CompteRendu passation={p} />
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {(p.statut === 'echec' || (p.statut === 'planifiee' && p.dateEffet <= aujourdhui())) && (
                        <button type="button" className="btn btn-secondaire btn-petit" disabled={action === p.id}
                          onClick={() => agir(p.id, fonctionsService.relancerPassation)}>
                          {action === p.id ? <IconeChargement /> : <RotateCcw size={14} aria-hidden />}
                          Relancer
                        </button>
                      )}
                      {p.statut === 'planifiee' && (
                        <button type="button" className="btn btn-fantome btn-petit" disabled={action === p.id}
                          onClick={() => agir(p.id, fonctionsService.annulerPassation)}>
                          <X size={14} aria-hidden />
                          Annuler
                        </button>
                      )}
                      {p.statut === 'executee' && <CircleCheck size={16} aria-label="Exécutée" color="var(--vert-700)" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {choisie && <FormulairePassation fonction={choisie} fermer={() => setChoisie(undefined)} faite={recharger} />}
    </>
  );
}
