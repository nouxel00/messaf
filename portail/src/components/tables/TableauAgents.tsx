import { useNavigate, Link } from 'react-router-dom';
import type { Referentiel } from '@/hooks/useReferentiel';
import type { Agent } from '@/types/agent';
import { nomComplet } from '@/utils/format';
import { BadgeEtat } from '../ui/Badges';

interface Props {
  agents: Agent[];
  referentiel?: Referentiel;
}

/** Tableau sur grand écran, cartes empilées sur petit écran (bascule en CSS). */
export function TableauAgents({ agents, referentiel }: Props) {
  const navigate = useNavigate();
  const libelle = (code?: string) => referentiel?.libelle(code) ?? code ?? '—';
  const intitulePoste = (a: Agent) => a.poste?.intitule ?? referentiel?.poste(a.affectation?.poste)?.intitule;

  return (
    <>
      <div className="tableau-conteneur">
        <table className="tableau">
          <thead>
            <tr>
              <th scope="col">Matricule</th>
              <th scope="col">Nom et prénoms</th>
              <th scope="col">Direction / service</th>
              <th scope="col">Poste</th>
              <th scope="col">Identifiant Matrix</th>
              <th scope="col">État</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => {
              const lien = `/agents/${a.identite.matricule}`;
              return (
                <tr key={a.identite.matricule} onClick={() => navigate(lien)}>
                  <td className="mono">{a.identite.matricule}</td>
                  <td>
                    <Link to={lien} className="cellule-principale" style={{ color: 'inherit', textDecoration: 'none' }}>
                      {nomComplet(a.identite.nom, a.identite.prenoms)}
                    </Link>
                    <div className="cellule-secondaire">{libelle(a.profil.ministere)}</div>
                  </td>
                  <td>
                    <div>{libelle(a.profil.direction)}</div>
                    <div className="cellule-secondaire">{libelle(a.profil.service)}</div>
                  </td>
                  <td>
                    <div>{intitulePoste(a) ?? '—'}</div>
                    <div className="cellule-secondaire mono">{a.affectation?.poste}</div>
                  </td>
                  <td>
                    <span className="matrix-id">{a.matrixId}</span>
                  </td>
                  <td>
                    <BadgeEtat valeur={a.etat} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="cartes-agents">
        {agents.map((a) => (
          <li key={a.identite.matricule}>
            <Link to={`/agents/${a.identite.matricule}`} className="carte-agent">
              <div className="carte-agent-haut">
                <div>
                  <div className="cellule-principale">{nomComplet(a.identite.nom, a.identite.prenoms)}</div>
                  <div className="cellule-secondaire mono">{a.identite.matricule}</div>
                </div>
                <BadgeEtat valeur={a.etat} />
              </div>
              <dl>
                <dt>Ministère</dt>
                <dd>{libelle(a.profil.ministere)}</dd>
                <dt>Direction</dt>
                <dd>{libelle(a.profil.direction)}</dd>
                <dt>Service</dt>
                <dd>{libelle(a.profil.service)}</dd>
                <dt>Poste</dt>
                <dd>{intitulePoste(a) ?? '—'}</dd>
                <dt>Matrix</dt>
                <dd>
                  <span className="matrix-id">{a.matrixId}</span>
                </dd>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
