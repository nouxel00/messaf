import { config } from '@/config/env';
import { ApiError } from './errors';

/**
 * Client HTTP de l'API d'administration. Seuls les services l'utilisent : aucun composant
 * React n'appelle fetch directement.
 * Chaque appel porte le jeton Keycloak de l'utilisateur (en-tête Authorization: Bearer).
 */

type FournisseurJeton = () => Promise<string | null>;
let fournisseurJeton: FournisseurJeton = async () => null;

/** Branché par la couche d'authentification à l'ouverture de la session. */
export function definirFournisseurJeton(fournisseur: FournisseurJeton): void {
  fournisseurJeton = fournisseur;
}

interface OptionsRequete {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  corps?: unknown;
  accept?: string;
  signal?: AbortSignal;
}

async function envoyer(chemin: string, options: OptionsRequete): Promise<Response> {
  const jeton = await fournisseurJeton();
  const entetes: Record<string, string> = { Accept: options.accept ?? 'application/json' };
  if (options.corps !== undefined) entetes['Content-Type'] = 'application/json';
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;

  const reponse = await fetch(`${config.apiBaseUrl}${chemin}`, {
    method: options.method ?? 'GET',
    headers: entetes,
    body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
    signal: options.signal,
  });
  if (!reponse.ok) throw await lireErreur(reponse);
  return reponse;
}

/**
 * Le format des erreurs n'est pas encore fixé dans api/openapi.yaml : on lit prudemment
 * `message`/`detail`, `code` et `champs` s'ils existent.
 */
async function lireErreur(reponse: Response): Promise<ApiError> {
  let corps: Record<string, unknown> = {};
  try {
    corps = (await reponse.json()) as Record<string, unknown>;
  } catch {
    /* corps non JSON */
  }
  const message =
    (typeof corps.message === 'string' && corps.message) ||
    (typeof corps.detail === 'string' && corps.detail) ||
    messageParStatut(reponse.status);
  const champs =
    typeof corps.champs === 'object' && corps.champs ? (corps.champs as Record<string, string>) : undefined;
  return new ApiError(message, reponse.status, typeof corps.code === 'string' ? corps.code : undefined, champs);
}

function messageParStatut(status: number): string {
  switch (status) {
    case 400:
    case 422:
      return 'Les informations envoyées ont été refusées par le serveur.';
    case 401:
      return 'Votre session a expiré. Reconnectez-vous.';
    case 403:
      return "Vous n'êtes pas autorisé à effectuer cette opération pour ce périmètre.";
    case 404:
      return 'Élément introuvable.';
    case 409:
      return 'Ce matricule est déjà utilisé.';
    default:
      return `Le serveur a répondu par une erreur (${status}).`;
  }
}

export const api = {
  async json<T>(chemin: string, options: OptionsRequete = {}): Promise<T> {
    const reponse = await envoyer(chemin, options);
    return (await reponse.json()) as T;
  },
  async blob(chemin: string, options: OptionsRequete = {}): Promise<Blob> {
    const reponse = await envoyer(chemin, options);
    return reponse.blob();
  },
};
