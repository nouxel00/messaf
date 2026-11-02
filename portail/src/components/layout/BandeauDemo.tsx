import { FlaskConical } from 'lucide-react';
import { config, modeDemonstration } from '@/config/env';

/** Indicateur permanent : impossible de confondre la démonstration avec un service réel. */
export function BandeauDemo() {
  if (!modeDemonstration) return null;
  const parties = [
    config.modeAuth === 'demo' && 'connexion fictive',
    config.sourceDonnees === 'demo' && 'données fictives et créations simulées',
  ].filter(Boolean);
  return (
    <div className="bandeau-demo" role="note">
      <FlaskConical size={15} aria-hidden />
      <span>MODE DÉMONSTRATION — {parties.join(', ')} · aucun compte Keycloak ou Matrix n'est créé</span>
    </div>
  );
}
