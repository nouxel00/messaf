import { NonDisponibleError } from './errors';
import type { ReferentielService } from './referentiel.service';

/**
 * POINT À VALIDER AVEC AXEL : le document de démarrage ne définit pas encore de route
 * pour lire l'organigramme et les postes. Plutôt que d'en inventer une, le portail
 * signale clairement l'absence. Brancher ici les routes une fois ajoutées à api/openapi.yaml.
 */
const absent = () =>
  Promise.reject(
    new NonDisponibleError(
      "La lecture des structures et des postes n'est pas encore définie dans le contrat de l'API (api/openapi.yaml).",
    ),
  );

export const referentielApi: ReferentielService = {
  structuresDuMinistere: absent,
  postesDuMinistere: absent,
};
