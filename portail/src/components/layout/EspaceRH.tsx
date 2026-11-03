import { LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth, useSession } from '@/contexts/AuthContext';
import { ReferentielProvider, useReferentielRH } from '@/contexts/ReferentielContext';
import { LIBELLES_ROLE } from '@/types/messaf';
import { peutAuditer, peutConsulterAgents, peutSuivreAbsences } from '@/utils/permissions';
import { BarreLaterale } from '../navigation/BarreLaterale';
import { BandeauDemo } from './BandeauDemo';

function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join('');
}

function Entete({ ouvrirMenu }: { ouvrirMenu: () => void }) {
  const session = useSession();
  const { deconnecter } = useAuth();
  const { referentiel } = useReferentielRH();
  const navigate = useNavigate();
  const role = session.roles.map((r) => LIBELLES_ROLE[r]).join(', ');

  const quitter = async () => {
    await deconnecter();
    navigate('/connexion', { replace: true });
  };

  return (
    <header className="entete">
      <button
        type="button"
        className="btn btn-secondaire btn-icone bouton-menu"
        onClick={ouvrirMenu}
        aria-label="Ouvrir le menu"
        aria-controls="navigation-principale"
      >
        <Menu size={18} aria-hidden />
      </button>
      <div className="entete-perimetre">
        <span className="entete-perimetre-label">Périmètre administratif</span>
        <span className="entete-perimetre-valeur">{referentiel?.libelle(session.ministere) ?? session.ministere}</span>
      </div>
      <div className="entete-droite">
        <div className="utilisateur">
          <span className="utilisateur-avatar" aria-hidden>
            {initiales(session.nomComplet)}
          </span>
          <span className="utilisateur-texte">
            <span className="utilisateur-nom" style={{ display: 'block' }}>
              {session.nomComplet}
            </span>
            <span className="utilisateur-role">
              {role}
              {session.source === 'demo' && ' · compte fictif'}
            </span>
          </span>
        </div>
        <button type="button" className="btn btn-secondaire btn-petit" onClick={quitter} aria-label="Déconnexion">
          <LogOut size={15} aria-hidden />
          <span className="texte-bouton">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}

/** Coque commune du portail : barre latérale, en-tête institutionnel, zone de contenu. */
export function EspaceRH() {
  const session = useSession();
  const [menuOuvert, setMenuOuvert] = useState(false);
  // L'organigramme n'est lu que par les rôles qui y ont droit dans l'API
  const lireReferentiel = peutConsulterAgents(session) || peutAuditer(session) || peutSuivreAbsences(session);

  return (
    <ReferentielProvider ministere={session.ministere} actif={lireReferentiel}>
      <div className="app">
        <BarreLaterale ouverte={menuOuvert} fermer={() => setMenuOuvert(false)} />
        <div className="principal">
          <BandeauDemo />
          <Entete ouvrirMenu={() => setMenuOuvert(true)} />
          <main className="contenu" id="contenu">
            <Outlet />
          </main>
        </div>
      </div>
    </ReferentielProvider>
  );
}
