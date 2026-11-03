import { RefreshCw, ScrollText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alerte } from '@/components/ui/Alerte';
import { Chargeur } from '@/components/ui/Chargeur';
import { ErreurChargement } from '@/components/ui/ErreurChargement';
import { EtatVide } from '@/components/ui/EtatVide';
import { useSession } from '@/contexts/AuthContext';
import { useReferentielRH } from '@/contexts/ReferentielContext';
import { useAsync } from '@/hooks/useAsync';
import { auditService } from '@/services/audit.service';
import {
  LIBELLES_ACTION_AUDIT,
  LIBELLES_RESULTAT_AUDIT,
  type EntreeAudit,
  type ResultatAudit,
} from '@/types/audit';
import { HABILITATIONS, LIBELLES_HABILITATION, type Habilitation } from '@/types/messaf';
import { formaterDateHeure } from '@/utils/format';

const LIMITE = 200;

const tonResultat: Record<ResultatAudit, string> = {
  succes: 'badge-vert',
  refus: 'badge-rouge',
  echec: 'badge-or',
};

/** Le détail technique d'une entrée, en phrases courtes. */
function lignesDetail(e: EntreeAudit): string[] {
  const d = e.detail ?? {};
  const texte = (cle: string) => (typeof d[cle] === 'string' && d[cle] ? (d[cle] as string) : undefined);
  const lignes: string[] = [];
  const motif = texte('motif');
  if (motif) lignes.push(e.resultat === 'refus' ? `Raison du refus : ${motif}` : `Motif : ${motif}`);
  if (typeof d.sessions_fermees === 'number') {
    const n = d.sessions_fermees;
    lignes.push(`${n} session${n > 1 ? 's' : ''} fermée${n > 1 ? 's' : ''}`);
  }
  const poste = texte('poste');
  if (poste) lignes.push(`Poste ${poste}`);
  const habilitation = texte('habilitation');
  if (habilitation) {
    const connue = (HABILITATIONS as readonly string[]).includes(habilitation);
    lignes.push(`Habilitation : ${connue ? LIBELLES_HABILITATION[habilitation as Habilitation] : habilitation}`);
  }
  const erreur = texte('erreur');
  if (erreur) lignes.push(`Erreur${texte('etape') ? ` (${texte('etape')})` : ''} : ${erreur}`);
  return lignes;
}

export function JournalAuditPage() {
  const session = useSession();
  const { referentiel } = useReferentielRH();
  const { donnees, erreur, chargement, recharger } = useAsync(
    () => auditService.journal(session.ministere, LIMITE),
    [session.ministere],
  );
  const [action, setAction] = useState('');
  const [resultat, setResultat] = useState('');

  const entrees = useMemo(
    () => (donnees ?? []).filter((e) => (!action || e.action === action) && (!resultat || e.resultat === resultat)),
    [donnees, action, resultat],
  );
  const refus = (donnees ?? []).filter((e) => e.resultat === 'refus').length;

  return (
    <>
      <div className="page-entete">
        <div>
          <h1>Journal d'audit</h1>
          <p>
            {referentiel?.libelle(session.ministere) ?? session.ministere} · créations, fiches d'enrôlement,
            révocations, réactivations, et chaque refus
            {auditService.simulation && ' · journal fictif'}
          </p>
        </div>
        <button type="button" className="btn btn-secondaire" onClick={recharger} disabled={chargement}>
          <RefreshCw size={16} aria-hidden />
          Actualiser
        </button>
      </div>

      <Alerte ton="info" titre="Journal en ajout seul">
        Personne ne peut modifier ni effacer une entrée, pas même un administrateur de l'application.
      </Alerte>

      {erreur ? (
        <ErreurChargement erreur={erreur} recharger={recharger} />
      ) : (
        <section className="carte mt">
          <div className="barre-filtres barre-filtres-audit">
            <div className="champ">
              <label className="champ-label" htmlFor="filtre-action">
                Action
              </label>
              <select id="filtre-action" className="select" value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">Toutes les actions</option>
                {Object.entries(LIBELLES_ACTION_AUDIT).map(([code, libelle]) => (
                  <option key={code} value={code}>
                    {libelle}
                  </option>
                ))}
              </select>
            </div>
            <div className="champ">
              <label className="champ-label" htmlFor="filtre-resultat">
                Résultat
              </label>
              <select id="filtre-resultat" className="select" value={resultat} onChange={(e) => setResultat(e.target.value)}>
                <option value="">Tous les résultats</option>
                {Object.entries(LIBELLES_RESULTAT_AUDIT).map(([code, libelle]) => (
                  <option key={code} value={code}>
                    {libelle}
                  </option>
                ))}
              </select>
            </div>
            <p className="cellule-secondaire" style={{ alignSelf: 'center' }}>
              {donnees ? `${donnees.length} entrée${donnees.length > 1 ? 's' : ''}, dont ${refus} refus` : ''}
            </p>
          </div>

          {chargement ? (
            <Chargeur libelle="Chargement du journal…" />
          ) : entrees.length === 0 ? (
            <EtatVide icone={ScrollText} titre="Aucune entrée">
              {action || resultat ? 'Aucune entrée ne correspond à ces filtres.' : undefined}
            </EtatVide>
          ) : (
            <div className="tableau-defilant">
              <table className="tableau tableau-statique">
                <thead>
                  <tr>
                    <th scope="col">Date et heure</th>
                    <th scope="col">Auteur</th>
                    <th scope="col">Action</th>
                    <th scope="col">Agent concerné</th>
                    <th scope="col">Résultat</th>
                    <th scope="col">Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {entrees.map((e) => (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formaterDateHeure(e.horodatage)}</td>
                      <td className="mono">{e.auteur}</td>
                      <td>{LIBELLES_ACTION_AUDIT[e.action] ?? e.action}</td>
                      <td className="mono">{e.cible ?? '—'}</td>
                      <td>
                        <span className={`badge ${tonResultat[e.resultat]}`}>{LIBELLES_RESULTAT_AUDIT[e.resultat]}</span>
                      </td>
                      <td>
                        <ul className="detail-audit">
                          {lignesDetail(e).map((l) => (
                            <li key={l}>{l}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {donnees && donnees.length >= LIMITE && (
            <p className="pied-liste">Seules les {LIMITE} entrées les plus récentes sont affichées.</p>
          )}
        </section>
      )}
    </>
  );
}
