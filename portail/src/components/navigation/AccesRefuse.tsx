import { Lock, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROLES_ESPACE_RH } from '@/config/messaf';
import { useAuth } from '@/contexts/AuthContext';
import { LIBELLES_ROLE } from '@/types/messaf';
import { BandeauDemo } from '../layout/BandeauDemo';
import { Marque } from '../ui/Marque';

export function AccesRefuse() {
  const { session, deconnecter } = useAuth();
  const navigate = useNavigate();
  const roles = session?.roles.length ? session.roles.map((r) => LIBELLES_ROLE[r]).join(', ') : 'aucun rôle';

  const quitter = async () => {
    await deconnecter();
    navigate('/connexion', { replace: true });
  };

  return (
    <>
      <BandeauDemo />
      <main className="page-refus">
        <div className="carte" style={{ maxWidth: 520, width: '100%' }}>
          <div className="carte-entete" style={{ background: 'var(--vert-900)', borderRadius: '14px 14px 0 0' }}>
            <Marque />
          </div>
          <div className="carte-corps" style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className="succes-icone" style={{ background: 'var(--rouge-50)', color: 'var(--rouge-600)', borderColor: 'var(--rouge-100)' }}>
                <Lock size={24} aria-hidden />
              </span>
              <h1 style={{ fontSize: 20 }}>Accès réservé aux responsables RH</h1>
            </div>
            <p>
              Le compte <strong>{session?.nomComplet}</strong> ({roles}) n'a pas accès à l'espace RH. Il faut le rôle{' '}
              {ROLES_ESPACE_RH.map((r) => (
                <code key={r}>{r}</code>
              ))}
              .
            </p>
            <p style={{ color: 'var(--texte-doux)', fontSize: 14 }}>
              Un agent sans rôle particulier n'accède qu'à la messagerie MESSAF. Les autres espaces du portail ne font
              pas partie de cette version.
            </p>
          </div>
          <div className="carte-pied">
            <span />
            <button type="button" className="btn btn-primaire" onClick={quitter}>
              <LogOut size={16} aria-hidden />
              Changer de compte
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
