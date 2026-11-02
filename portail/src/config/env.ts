import type { ModeAuthentification } from '@/types/auth';

export type SourceDonnees = 'demo' | 'api';

const env = import.meta.env;

function lireChoix<T extends string>(valeur: string | undefined, permis: readonly T[], defaut: T): T {
  return permis.includes(valeur as T) ? (valeur as T) : defaut;
}

/** Configuration lue au démarrage. Par défaut, tout fonctionne en démonstration. */
export const config = {
  sourceDonnees: lireChoix<SourceDonnees>(env.VITE_DATA_SOURCE, ['demo', 'api'], 'demo'),
  modeAuth: lireChoix<ModeAuthentification>(env.VITE_AUTH_MODE, ['demo', 'keycloak'], 'demo'),
  apiBaseUrl: (env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/+$/, ''),
  keycloak: {
    url: env.VITE_KEYCLOAK_URL ?? '',
    realm: env.VITE_KEYCLOAK_REALM ?? '',
    clientId: env.VITE_KEYCLOAK_CLIENT_ID ?? '',
  },
} as const;

/** Vrai dès qu'une partie du portail fonctionne avec des données ou un accès fictifs. */
export const modeDemonstration = config.sourceDonnees === 'demo' || config.modeAuth === 'demo';
