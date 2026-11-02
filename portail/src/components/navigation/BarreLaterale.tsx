import { LayoutDashboard, UserPlus, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Marque } from '../ui/Marque';

interface Props {
  ouverte: boolean;
  fermer: () => void;
}

const liens = [
  { vers: '/', libelle: 'Tableau de bord', icone: LayoutDashboard, exact: true },
  { vers: '/agents', libelle: 'Agents', icone: Users, exact: true },
  { vers: '/agents/nouveau', libelle: 'Enregistrer un agent', icone: UserPlus, exact: false },
];

export function BarreLaterale({ ouverte, fermer }: Props) {
  return (
    <>
      <aside className={`sidebar ${ouverte ? 'ouverte' : ''}`} id="navigation-principale" aria-label="Navigation principale">
        <div className="sidebar-marque">
          <Marque />
        </div>
        <nav className="sidebar-nav">
          <p className="sidebar-section">Enrôlement</p>
          {liens.map(({ vers, libelle, icone: Icone, exact }) => (
            <NavLink
              key={vers}
              to={vers}
              end={exact}
              onClick={fermer}
              className={({ isActive }) => `sidebar-lien ${isActive ? 'actif' : ''}`}
            >
              <Icone size={18} aria-hidden />
              {libelle}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-pied">
          Portail d'administration MESSAF-BF
          <br />
          Espace RH — version prototype
        </div>
      </aside>
      <div className={`voile ${ouverte ? 'visible' : ''}`} onClick={fermer} aria-hidden />
    </>
  );
}
