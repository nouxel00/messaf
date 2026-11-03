import { ArrowLeftRight, CalendarClock, LayoutDashboard, ScrollText, ShieldOff, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useSession } from '@/contexts/AuthContext';
import type { SessionUtilisateur } from '@/types/auth';
import { peutAuditer, peutEnroler, peutPasser, peutRevoquer, peutSuivreAbsences } from '@/utils/permissions';
import { Marque } from '../ui/Marque';

interface Props {
  ouverte: boolean;
  fermer: () => void;
}

interface Lien {
  vers: string;
  libelle: string;
  icone: LucideIcon;
  exact: boolean;
  /** Lien réservé à certains rôles à l'intérieur de sa section. */
  visible?: (s: SessionUtilisateur) => boolean;
}

/** Une section par espace ; chacune n'apparaît qu'aux rôles concernés. */
const sections: { titre: string; visible: (s: SessionUtilisateur) => boolean; liens: Lien[] }[] = [
  {
    titre: 'Enrôlement',
    visible: peutEnroler,
    liens: [
      { vers: '/', libelle: 'Tableau de bord', icone: LayoutDashboard, exact: true },
      { vers: '/agents', libelle: 'Agents', icone: Users, exact: true },
      { vers: '/agents/nouveau', libelle: 'Enregistrer un agent', icone: UserPlus, exact: false },
    ],
  },
  {
    titre: 'Accès des agents',
    // Le gestionnaire RH a déjà le lien « Agents » dans la section Enrôlement
    visible: (s) => peutRevoquer(s) && !peutEnroler(s),
    liens: [{ vers: '/agents', libelle: 'Agents et révocation', icone: ShieldOff, exact: true }],
  },
  {
    titre: 'Fonctions',
    visible: (s) => peutPasser(s) || peutSuivreAbsences(s),
    liens: [
      { vers: '/fonctions', libelle: 'Fonctions et passations', icone: ArrowLeftRight, exact: true, visible: peutPasser },
      { vers: '/absences', libelle: 'Absences et intérims', icone: CalendarClock, exact: true, visible: peutSuivreAbsences },
    ],
  },
  {
    titre: 'Contrôle',
    visible: peutAuditer,
    liens: [{ vers: '/audit', libelle: "Journal d'audit", icone: ScrollText, exact: true }],
  },
];

export function BarreLaterale({ ouverte, fermer }: Props) {
  const session = useSession();
  return (
    <>
      <aside className={`sidebar ${ouverte ? 'ouverte' : ''}`} id="navigation-principale" aria-label="Navigation principale">
        <div className="sidebar-marque">
          <Marque />
        </div>
        <nav className="sidebar-nav">
          {sections
            .filter((section) => section.visible(session))
            .map((section) => (
              <div key={section.titre}>
                <p className="sidebar-section">{section.titre}</p>
                {section.liens.filter((l) => !l.visible || l.visible(session)).map(({ vers, libelle, icone: Icone, exact }) => (
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
              </div>
            ))}
        </nav>
        <div className="sidebar-pied">
          Portail d'administration MESSAF-BF
          <br />
          Version prototype
        </div>
      </aside>
      <div className={`voile ${ouverte ? 'visible' : ''}`} onClick={fermer} aria-hidden />
    </>
  );
}
