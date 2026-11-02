import { postesDemo, structuresDemo } from '@/mocks/organizations.mock';
import type { ReferentielService } from '../referentiel.service';
import { latence } from './outils';

function codesDuMinistere(ministere: string): Set<string> {
  const codes = new Set<string>([ministere]);
  let ajoute = true;
  while (ajoute) {
    ajoute = false;
    for (const s of structuresDemo) {
      if (s.parent && codes.has(s.parent) && !codes.has(s.code)) {
        codes.add(s.code);
        ajoute = true;
      }
    }
  }
  return codes;
}

/** Simulation : le cloisonnement par ministère imite ce que l'API fera côté serveur. */
export const referentielDemo: ReferentielService = {
  async structuresDuMinistere(ministere) {
    await latence(150, 350);
    const codes = codesDuMinistere(ministere);
    return structuresDemo.filter((s) => codes.has(s.code));
  },
  async postesDuMinistere(ministere) {
    await latence(150, 350);
    const codes = codesDuMinistere(ministere);
    return postesDemo.filter((p) => codes.has(p.structure));
  },
};
