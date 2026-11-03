import { routesApi } from '@/config/api';
import type { Habilitation } from '@/types/messaf';
import type { Poste } from '@/types/position';
import type { Structure, TypeStructure } from '@/types/structure';
import { api } from './api';
import type { ReferentielService } from './referentiel.service';

/**
 * Organigramme et postes, lus dans l'API d'administration (lecture seule) :
 *   GET /structures?ministere=… et GET /postes?ministere=…
 * L'API refuse un ministère hors du périmètre de l'utilisateur.
 */

interface StructureApi {
  code: string;
  libelle: string;
  sigle: string | null;
  type: TypeStructure;
  parent: string | null;
}

/** Un poste, tel que l'API le renvoie (aussi dans la vue d'un agent). */
export interface PosteApi {
  code: string;
  intitule: string;
  structure: string;
  poste_superieur: string | null;
  habilitation_requise: Habilitation;
}

export function versPoste(p: PosteApi): Poste {
  return {
    code: p.code,
    intitule: p.intitule,
    structure: p.structure,
    posteSuperieur: p.poste_superieur ?? undefined,
    habilitationRequise: p.habilitation_requise,
  };
}

function versStructure(s: StructureApi): Structure {
  return {
    code: s.code,
    libelle: s.libelle,
    sigle: s.sigle ?? undefined,
    type: s.type,
    parent: s.parent ?? undefined,
  };
}

export const referentielApi: ReferentielService = {
  async structuresDuMinistere(ministere) {
    return (await api.json<StructureApi[]>(routesApi.structures(ministere))).map(versStructure);
  },
  async postesDuMinistere(ministere) {
    return (await api.json<PosteApi[]>(routesApi.postes(ministere))).map(versPoste);
  },
};
