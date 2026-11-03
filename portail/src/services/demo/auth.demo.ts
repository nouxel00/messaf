import { comptesDemo, MOT_DE_PASSE_DEMO } from '@/mocks/comptes-demo.mock';
import type { SessionUtilisateur } from '@/types/auth';
import type { AuthService } from '../auth.service';
import { ApiError } from '../errors';
import { effacerStockage, ecrireStockage, latence, lireStockage } from './outils';

/**
 * Connexion FICTIVE, séparée de l'authentification réelle.
 * Le mot de passe saisi est comparé puis oublié : seule la session (nom, rôles, ministère)
 * est gardée dans le sessionStorage, effacé à la fermeture de l'onglet.
 */
const CLE_SESSION = 'messaf.demo.session.v1';

/** Session fictive en cours : sert d'auteur aux actions inscrites dans le journal simulé. */
export function sessionDemoCourante(): SessionUtilisateur | null {
  return lireStockage<SessionUtilisateur | null>(sessionStorage, CLE_SESSION, null);
}

export const authDemo: AuthService = {
  mode: 'demo',

  async restaurer() {
    return lireStockage<SessionUtilisateur | null>(sessionStorage, CLE_SESSION, null);
  },

  async connecter(identifiants) {
    await latence(400, 700);
    const compte = comptesDemo.find((c) => c.identifiant === identifiants?.identifiant.trim());
    if (!compte || identifiants?.motDePasse !== MOT_DE_PASSE_DEMO) {
      throw new ApiError('Identifiant ou mot de passe incorrect.', 401);
    }
    const session: SessionUtilisateur = {
      identifiant: compte.identifiant,
      nomComplet: compte.nomComplet,
      matricule: compte.matricule,
      roles: compte.roles,
      ministere: compte.ministere,
      poste: compte.poste,
      ouverteLe: new Date().toISOString(),
      source: 'demo',
    };
    ecrireStockage(sessionStorage, CLE_SESSION, session);
    return session;
  },

  async deconnecter() {
    effacerStockage(sessionStorage, CLE_SESSION);
  },

  async jeton() {
    return null;
  },
};
