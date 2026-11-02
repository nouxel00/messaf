import { Search, UserPlus, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TableauAgents } from '@/components/tables/TableauAgents';
import { Chargeur } from '@/components/ui/Chargeur';
import { ErreurChargement } from '@/components/ui/ErreurChargement';
import { EtatVide } from '@/components/ui/EtatVide';
import { useSession } from '@/contexts/AuthContext';
import { useReferentielRH } from '@/contexts/ReferentielContext';
import { useAgents } from '@/hooks/useAgents';
import { agentsService } from '@/services/agents.service';
import { ETATS_COMPTE, LIBELLES_ETAT } from '@/types/messaf';
import { normaliser } from '@/utils/format';

export function ListeAgentsPage() {
  const session = useSession();
  const { referentiel } = useReferentielRH();
  const { donnees: agents, erreur, chargement, recharger } = useAgents();
  const [recherche, setRecherche] = useState('');
  const [direction, setDirection] = useState('');
  const [etat, setEtat] = useState('');

  const directions = referentiel?.enfants(session.ministere) ?? [];

  const filtres = useMemo(() => {
    const terme = normaliser(recherche);
    return (agents ?? []).filter((a) => {
      if (direction && a.profil.direction !== direction) return false;
      if (etat && a.etat !== etat) return false;
      if (!terme) return true;
      const { matricule, nom, prenoms } = a.identite;
      return [matricule, nom, prenoms, `${prenoms} ${nom}`, `${nom} ${prenoms}`].some((v) =>
        normaliser(v).includes(terme),
      );
    });
  }, [agents, recherche, direction, etat]);

  const filtreActif = !!(recherche || direction || etat);
  const effacer = () => {
    setRecherche('');
    setDirection('');
    setEtat('');
  };

  return (
    <>
      <div className="page-entete">
        <div>
          <h1>Agents enregistrés</h1>
          <p>
            {referentiel?.libelle(session.ministere) ?? session.ministere}
            {agentsService.simulation && ' · jeu de données fictif'}
          </p>
        </div>
        <Link to="/agents/nouveau" className="btn btn-primaire">
          <UserPlus size={17} aria-hidden />
          Enregistrer un nouvel agent
        </Link>
      </div>

      {erreur ? (
        <ErreurChargement erreur={erreur} recharger={recharger} />
      ) : (
        <section className="carte">
          <div className="barre-filtres" role="search">
            <div className="champ recherche">
              <label className="champ-label" htmlFor="recherche-agent">
                Rechercher
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={17} aria-hidden />
                <input
                  id="recherche-agent"
                  className="input"
                  type="search"
                  placeholder="Matricule, nom ou prénoms"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </div>
            </div>
            <div className="champ">
              <label className="champ-label" htmlFor="filtre-direction">
                Direction
              </label>
              <select
                id="filtre-direction"
                className="select"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
              >
                <option value="">Toutes les directions</option>
                {directions.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div className="champ">
              <label className="champ-label" htmlFor="filtre-etat">
                État du compte
              </label>
              <select id="filtre-etat" className="select" value={etat} onChange={(e) => setEtat(e.target.value)}>
                <option value="">Tous les états</option>
                {ETATS_COMPTE.map((e) => (
                  <option key={e} value={e}>
                    {LIBELLES_ETAT[e]}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-secondaire" onClick={effacer} disabled={!filtreActif}>
              <X size={16} aria-hidden />
              Effacer
            </button>
          </div>

          {chargement ? (
            <Chargeur libelle="Chargement des agents…" />
          ) : filtres.length === 0 ? (
            <EtatVide
              icone={Users}
              titre={filtreActif ? 'Aucun agent ne correspond à votre recherche' : 'Aucun agent enregistré'}
              action={
                filtreActif ? (
                  <button type="button" className="btn btn-secondaire btn-petit" onClick={effacer}>
                    Effacer les filtres
                  </button>
                ) : (
                  <Link to="/agents/nouveau" className="btn btn-primaire btn-petit">
                    Enregistrer un agent
                  </Link>
                )
              }
            >
              {filtreActif ? 'Vérifiez le matricule ou l’orthographe du nom.' : undefined}
            </EtatVide>
          ) : (
            <>
              <TableauAgents agents={filtres} referentiel={referentiel} />
              <p className="pied-liste" aria-live="polite">
                {filtres.length} agent{filtres.length > 1 ? 's' : ''}
                {filtreActif && ` sur ${agents?.length}`}
              </p>
            </>
          )}
        </section>
      )}
    </>
  );
}
