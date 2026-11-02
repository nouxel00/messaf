import { useMemo } from 'react';
import { referentielService } from '@/services/referentiel.service';
import type { Poste } from '@/types/position';
import type { Structure } from '@/types/structure';
import { useAsync } from './useAsync';

export interface Referentiel {
  structures: Structure[];
  postes: Poste[];
  structure(code?: string): Structure | undefined;
  poste(code?: string): Poste | undefined;
  /** Libellé lisible d'une structure, ou son code si elle est inconnue. */
  libelle(code?: string): string;
  enfants(parent: string): Structure[];
}

/** Organigramme et postes du ministère, avec des accesseurs pratiques pour l'affichage. */
export function useReferentiel(ministere: string) {
  const etat = useAsync(
    () =>
      Promise.all([
        referentielService.structuresDuMinistere(ministere),
        referentielService.postesDuMinistere(ministere),
      ]),
    [ministere],
  );

  const referentiel = useMemo<Referentiel | undefined>(() => {
    if (!etat.donnees) return undefined;
    const [structures, postes] = etat.donnees;
    const parCode = new Map(structures.map((s) => [s.code, s]));
    const postesParCode = new Map(postes.map((p) => [p.code, p]));
    return {
      structures,
      postes,
      structure: (code) => (code ? parCode.get(code) : undefined),
      poste: (code) => (code ? postesParCode.get(code) : undefined),
      libelle: (code) => (code ? (parCode.get(code)?.libelle ?? code) : '—'),
      enfants: (parent) => structures.filter((s) => s.parent === parent),
    };
  }, [etat.donnees]);

  return { referentiel, chargement: etat.chargement, erreur: etat.erreur, recharger: etat.recharger };
}
