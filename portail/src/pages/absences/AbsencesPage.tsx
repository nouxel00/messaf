import { CalendarClock, CalendarOff, Check, Plus, RefreshCw, UserRoundCheck, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Champ } from '@/components/forms/Champ';
import { Alerte } from '@/components/ui/Alerte';
import { Chargeur, IconeChargement } from '@/components/ui/Chargeur';
import { ErreurChargement } from '@/components/ui/ErreurChargement';
import { EtatVide } from '@/components/ui/EtatVide';
import { Modale } from '@/components/ui/Modale';
import { useSession } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { agentsService } from '@/services/agents.service';
import { ApiError, messageErreur } from '@/services/errors';
import { fonctionsService } from '@/services/fonctions.service';
import type { Agent } from '@/types/agent';
import {
  LIBELLES_ETAT_ABSENCE,
  LIBELLES_STATUT_ABSENCE,
  STATUTS_ABSENCE,
  type Absence,
  type CompteRenduInterim,
  type EtatAbsence,
  type StatutAbsence,
} from '@/types/fonction';
import { LIBELLES_HABILITATION, RANG_HABILITATION } from '@/types/messaf';
import { aujourdhui, formaterDate, nomComplet } from '@/utils/format';
import { peutDeclarerAbsence } from '@/utils/permissions';

const tonEtat: Record<EtatAbsence, string> = {
  en_attente: 'badge-or',
  validee: 'badge-bleu',
  refusee: 'badge-rouge',
  en_cours: 'badge-vert',
  terminee: 'badge-neutre',
  annulee: 'badge-neutre',
};

function BadgeEtat({ etat }: { etat: EtatAbsence }) {
  return <span className={`badge ${tonEtat[etat]}`}>{LIBELLES_ETAT_ABSENCE[etat]}</span>;
}

const champsErreur = (e: unknown) => (e instanceof ApiError ? (e.champs ?? {}) : {});

function Periode({ a }: { a: Absence }) {
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {formaterDate(a.dateDebut)} → {formaterDate(a.dateFin)}
    </span>
  );
}

/** Ce que le bot a fait à l'ouverture ou à la clôture de l'intérim. */
function CompteRendu({ cr, titre }: { cr?: CompteRenduInterim; titre: string }) {
  if (!cr) return null;
  return (
    <div>
      <div className="cellule-secondaire">{titre}</div>
      <ul className="detail-audit">
        {cr.erreur && <li>Erreur : {cr.erreur}</li>}
        {cr.salons.map((s) => (
          <li key={s.nom}>
            <span className="mono">{s.nom}</span> : {s.erreur ? `échec (${s.erreur})` : s.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CelluleAgent({ a, suite }: { a: Absence; suite?: ReactNode }) {
  return (
    <>
      <div className="cellule-principale">{a.agent.nom}</div>
      <div className="cellule-secondaire">
        {a.intitule} · <span className="mono">{a.poste}</span>
      </div>
      {suite}
    </>
  );
}

// ----- Validation par le supérieur ---------------------------------------------------------

function FenetreValidation({
  absence,
  decision,
  fermer,
  faite,
}: {
  absence: Absence;
  decision: 'validee' | 'refusee';
  fermer: () => void;
  faite: () => void;
}) {
  const [motif, setMotif] = useState('');
  const [autre, setAutre] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>();
  const valider = decision === 'validee';
  const sansInterimaire = valider && !absence.interimaire && !autre.trim();

  const confirmer = async () => {
    setEnvoi(true);
    setErreur(undefined);
    try {
      await fonctionsService.validerAbsence(absence.id, decision, { motif: motif.trim(), interimaire: autre.trim() || undefined });
      faite();
      fermer();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modale
      ouverte
      titre={valider ? "Valider l'intérim" : 'Refuser la demande'}
      fermer={fermer}
      bloquee={envoi}
      actions={
        <>
          <button type="button" className="btn btn-secondaire" onClick={fermer} disabled={envoi}>
            Annuler
          </button>
          <button
            type="button"
            className={`btn ${valider ? 'btn-primaire' : 'btn-danger'}`}
            onClick={confirmer}
            disabled={envoi || (!valider && !motif.trim())}
          >
            {envoi ? <IconeChargement /> : valider ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
            {valider ? 'Valider' : 'Refuser'}
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <p>
          <strong>{absence.agent.nom}</strong> ({absence.intitule}) : {LIBELLES_STATUT_ABSENCE[absence.statut].toLowerCase()} du{' '}
          {formaterDate(absence.dateDebut)} au {formaterDate(absence.dateFin)}.
        </p>
        {erreur !== undefined && <Alerte ton="erreur">{messageErreur(erreur)}</Alerte>}
        {valider ? (
          <>
            <p style={{ color: 'var(--texte-doux)', fontSize: 14 }}>
              À la date de début, le bot invite l'intérimaire dans les salons de la fonction. Par moindre privilège, il ne
              reçoit pas l'historique : seulement les messages à venir et un dossier des affaires en cours. À la fin, il
              est retiré et le titulaire reçoit un compte rendu.
            </p>
            <p>
              Intérimaire proposé : <strong>{absence.interimaire?.nom ?? 'aucun'}</strong>
            </p>
            <Champ
              label="Désigner un autre intérimaire (matricule)"
              aide="Le supérieur peut désigner un agent d'une autre direction. Laissez vide pour garder la proposition."
              erreur={champsErreur(erreur).interimaire}
            >
              <input className="input mono" inputMode="numeric" maxLength={20} value={autre} onChange={(e) => setAutre(e.target.value)} />
            </Champ>
            {sansInterimaire && (
              <Alerte ton="attention">
                Sans intérimaire, personne ne supplée la fonction : seul le titulaire absent reste membre de ses
                salons.
              </Alerte>
            )}
          </>
        ) : (
          <Champ label="Motif du refus" requis aide="Communiqué à l'agent et inscrit au journal d'audit.">
            <input className="input" maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} />
          </Champ>
        )}
      </div>
    </Modale>
  );
}

// ----- Déclaration par les RH --------------------------------------------------------------

function FormulaireAbsence({ fermer, faite }: { fermer: () => void; faite: () => void }) {
  const session = useSession();
  const { donnees: agents, chargement } = useAsync(() => agentsService.lister({ ministere: session.ministere }), [session.ministere]);
  const [matricule, setMatricule] = useState('');
  const [statut, setStatut] = useState<StatutAbsence>('en_mission');
  const [precision, setPrecision] = useState('');
  const [debut, setDebut] = useState(aujourdhui());
  const [fin, setFin] = useState('');
  const [interimaire, setInterimaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>();

  const actifs = useMemo(
    () => (agents ?? []).filter((a) => a.etat !== 'revoque').sort((x, y) => x.identite.nom.localeCompare(y.identite.nom)),
    [agents],
  );
  const absent = actifs.find((a) => a.identite.matricule === matricule);
  const requis = absent?.poste?.habilitationRequise;
  // Proposition des RH : un agent de la même direction (le supérieur peut en désigner un autre)
  const candidats = absent
    ? actifs.filter((a) => a.identite.matricule !== matricule && a.profil.direction === absent.profil.direction)
    : [];
  const habilite = (a: Agent) => !requis || RANG_HABILITATION[a.habilitation] >= RANG_HABILITATION[requis];
  const champs = champsErreur(erreur);
  const datesInvalides = !!fin && fin < debut;

  const confirmer = async () => {
    setEnvoi(true);
    setErreur(undefined);
    try {
      await fonctionsService.declarerAbsence({
        matricule,
        statut,
        precision: precision.trim() || undefined,
        dateDebut: debut,
        dateFin: fin,
        interimaire: interimaire || undefined,
      });
      faite();
      fermer();
    } catch (e) {
      setErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modale
      ouverte
      titre="Déclarer une absence"
      fermer={fermer}
      bloquee={envoi}
      actions={
        <>
          <button type="button" className="btn btn-secondaire" onClick={fermer} disabled={envoi}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primaire"
            onClick={confirmer}
            disabled={envoi || !absent?.poste || !debut || !fin || datesInvalides}
          >
            {envoi ? <IconeChargement /> : <CalendarOff size={16} aria-hidden />}
            Envoyer au supérieur
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <p style={{ color: 'var(--texte-doux)', fontSize: 14 }}>
          La demande part au supérieur hiérarchique de l'agent, qui valide l'intérim. Le statut de l'agent est visible de
          ses correspondants pendant l'absence.
        </p>
        {erreur !== undefined && <Alerte ton="erreur">{messageErreur(erreur)}</Alerte>}
        <Champ label="Agent absent" requis erreur={champs.matricule ?? (absent && !absent.poste ? "Cet agent n'occupe aucun poste." : undefined)}>
          <select
            className="select"
            value={matricule}
            disabled={chargement}
            onChange={(e) => {
              setMatricule(e.target.value);
              setInterimaire('');
            }}
          >
            <option value="">{chargement ? 'Chargement des agents…' : "Choisissez l'agent"}</option>
            {actifs.map((a) => (
              <option key={a.identite.matricule} value={a.identite.matricule}>
                {nomComplet(a.identite.nom, a.identite.prenoms)} ({a.identite.matricule}){a.poste ? ` — ${a.poste.intitule}` : ''}
              </option>
            ))}
          </select>
        </Champ>
        <div className="grille-champs">
          <Champ label="Statut" requis erreur={champs.statut}>
            <select className="select" value={statut} onChange={(e) => setStatut(e.target.value as StatutAbsence)}>
              {STATUTS_ABSENCE.map((s) => (
                <option key={s} value={s}>
                  {LIBELLES_STATUT_ABSENCE[s]}
                </option>
              ))}
            </select>
          </Champ>
          <Champ label="Précision" aide="Ex. : mission à Bobo-Dioulasso." erreur={champs.precision}>
            <input className="input" maxLength={200} value={precision} onChange={(e) => setPrecision(e.target.value)} />
          </Champ>
          <Champ label="Du" requis erreur={champs.date_debut}>
            <input className="input" type="date" min={aujourdhui()} value={debut} onChange={(e) => setDebut(e.target.value)} />
          </Champ>
          <Champ label="Au (inclus)" requis erreur={champs.date_fin ?? (datesInvalides ? 'La fin précède le début.' : undefined)}>
            <input className="input" type="date" min={debut} value={fin} onChange={(e) => setFin(e.target.value)} />
          </Champ>
        </div>
        <Champ
          label="Intérimaire proposé"
          aide={
            requis
              ? `Un agent de la même direction, habilité « ${LIBELLES_HABILITATION[requis]} » au moins.`
              : 'Un agent de la même direction.'
          }
          erreur={champs.interimaire}
        >
          <select className="select" value={interimaire} onChange={(e) => setInterimaire(e.target.value)} disabled={!absent}>
            <option value="">Aucun (le supérieur désignera)</option>
            {candidats.map((a) => (
              <option key={a.identite.matricule} value={a.identite.matricule} disabled={!habilite(a)}>
                {nomComplet(a.identite.nom, a.identite.prenoms)} ({a.identite.matricule})
                {habilite(a) ? '' : ' — habilitation insuffisante'}
              </option>
            ))}
          </select>
        </Champ>
      </div>
    </Modale>
  );
}

// ----- Page --------------------------------------------------------------------------------

export function AbsencesPage() {
  const session = useSession();
  const absences = useAsync(() => fonctionsService.absences(session.ministere), [session.ministere]);
  const [validation, setValidation] = useState<{ absence: Absence; decision: 'validee' | 'refusee' }>();
  const [declaration, setDeclaration] = useState(false);
  const [action, setAction] = useState<number>();
  const [erreurAction, setErreurAction] = useState<unknown>();
  const declarer = peutDeclarerAbsence(session);

  const liste = absences.donnees ?? [];
  const aValider = liste.filter((a) => a.etat === 'en_attente');
  const actives = liste.filter((a) => a.etat === 'en_cours' || a.etat === 'validee');
  const passees = liste.filter((a) => a.etat === 'terminee' || a.etat === 'refusee' || a.etat === 'annulee');

  const terminer = async (a: Absence) => {
    setAction(a.id);
    setErreurAction(undefined);
    try {
      await fonctionsService.terminerAbsence(a.id);
      absences.recharger();
    } catch (e) {
      setErreurAction(e);
    } finally {
      setAction(undefined);
    }
  };

  const contenu = () => {
    if (absences.chargement) return <Chargeur libelle="Chargement des absences…" />;
    if (absences.erreur) return <ErreurChargement erreur={absences.erreur} recharger={absences.recharger} />;
    return (
      <>
        <section className="carte">
          <div className="carte-entete">
            <h2>À valider ({aValider.length})</h2>
          </div>
          {!aValider.length ? (
            <EtatVide icone={UserRoundCheck} titre="Aucune demande en attente" />
          ) : (
            <div className="tableau-defilant">
              <table className="tableau tableau-statique">
                <thead>
                  <tr>
                    <th scope="col">Agent</th>
                    <th scope="col">Absence</th>
                    <th scope="col">Intérimaire proposé</th>
                    <th scope="col">
                      <span className="visually-hidden">Décision</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aValider.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <CelluleAgent a={a} />
                      </td>
                      <td>
                        <div>{LIBELLES_STATUT_ABSENCE[a.statut]}{a.precision ? ` : ${a.precision}` : ''}</div>
                        <div className="cellule-secondaire">
                          <Periode a={a} />
                        </div>
                      </td>
                      <td>{a.interimaire?.nom ?? '—'}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {a.peutValider ? (
                          <>
                            <button type="button" className="btn btn-primaire btn-petit" onClick={() => setValidation({ absence: a, decision: 'validee' })}>
                              <Check size={14} aria-hidden />
                              Valider
                            </button>{' '}
                            <button type="button" className="btn btn-secondaire btn-petit" onClick={() => setValidation({ absence: a, decision: 'refusee' })}>
                              <X size={14} aria-hidden />
                              Refuser
                            </button>
                          </>
                        ) : (
                          <span className="cellule-secondaire">
                            Validation : {a.validateurs.map((v) => v.nom).join(', ') || 'supérieur non désigné'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="carte mt">
          <div className="carte-entete">
            <h2>Intérims en cours et à venir ({actives.length})</h2>
          </div>
          {erreurAction !== undefined && (
            <div className="carte-corps">
              <Alerte ton="erreur">{messageErreur(erreurAction)}</Alerte>
            </div>
          )}
          {!actives.length ? (
            <EtatVide icone={CalendarClock} titre="Aucun intérim en cours" />
          ) : (
            <div className="tableau-defilant">
              <table className="tableau tableau-statique">
                <thead>
                  <tr>
                    <th scope="col">Titulaire absent</th>
                    <th scope="col">Intérimaire</th>
                    <th scope="col">Période</th>
                    <th scope="col">État</th>
                    <th scope="col">
                      <span className="visually-hidden">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {actives.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <CelluleAgent a={a} suite={<div className="cellule-secondaire">{LIBELLES_STATUT_ABSENCE[a.statut]}</div>} />
                      </td>
                      <td>
                        {a.interimaire?.nom ?? 'aucun'}
                        <CompteRendu cr={a.debut} titre="Ouverture par le bot :" />
                      </td>
                      <td>
                        <Periode a={a} />
                      </td>
                      <td>
                        <BadgeEtat etat={a.etat} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className="btn btn-secondaire btn-petit" disabled={action === a.id} onClick={() => terminer(a)}>
                          {action === a.id ? <IconeChargement /> : <CalendarOff size={14} aria-hidden />}
                          {a.etat === 'en_cours' ? 'Retour anticipé' : 'Annuler'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="carte mt">
          <div className="carte-entete">
            <h2>Historique</h2>
          </div>
          {!passees.length ? (
            <EtatVide icone={CalendarClock} titre="Aucune absence passée" />
          ) : (
            <div className="tableau-defilant">
              <table className="tableau tableau-statique">
                <thead>
                  <tr>
                    <th scope="col">Agent</th>
                    <th scope="col">Période</th>
                    <th scope="col">Intérimaire</th>
                    <th scope="col">État</th>
                    <th scope="col">Compte rendu</th>
                  </tr>
                </thead>
                <tbody>
                  {passees.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <CelluleAgent a={a} />
                      </td>
                      <td>
                        <Periode a={a} />
                      </td>
                      <td>{a.interimaire?.nom ?? '—'}</td>
                      <td>
                        <BadgeEtat etat={a.etat} />
                        {a.motifRefus && <div className="cellule-secondaire">{a.motifRefus}</div>}
                      </td>
                      <td>
                        <CompteRendu cr={a.fin} titre="Clôture par le bot :" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    );
  };

  return (
    <>
      <div className="page-entete">
        <div>
          <h1>Absences et intérims</h1>
          <p>
            Les RH déclarent l'absence, le supérieur hiérarchique valide l'intérim, le bot ouvre et ferme l'accès de
            l'intérimaire aux dates prévues{fonctionsService.simulation && ' · intérims simulés'}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondaire" onClick={absences.recharger}>
            <RefreshCw size={16} aria-hidden />
            Actualiser
          </button>
          {declarer && (
            <button type="button" className="btn btn-primaire" onClick={() => setDeclaration(true)}>
              <Plus size={16} aria-hidden />
              Déclarer une absence
            </button>
          )}
        </div>
      </div>

      {contenu()}

      {validation && (
        <FenetreValidation
          absence={validation.absence}
          decision={validation.decision}
          fermer={() => setValidation(undefined)}
          faite={absences.recharger}
        />
      )}
      {declaration && <FormulaireAbsence fermer={() => setDeclaration(false)} faite={absences.recharger} />}
    </>
  );
}
