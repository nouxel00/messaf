/** Outils partagés par les services de simulation. Jamais utilisés en mode API. */

/** Simule le temps de réponse d'un serveur pour rendre visibles les états de chargement. */
export function latence(min = 300, max = 800): Promise<void> {
  const duree = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, duree));
}

/** Lecture tolérante du stockage du navigateur (mode privé, quota, données corrompues). */
export function lireStockage<T>(stockage: Storage, cle: string, defaut: T): T {
  try {
    const brut = stockage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}

export function ecrireStockage(stockage: Storage, cle: string, valeur: unknown): void {
  try {
    stockage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* stockage indisponible : la démonstration continue en mémoire */
  }
}

export function effacerStockage(stockage: Storage, cle: string): void {
  try {
    stockage.removeItem(cle);
  } catch {
    /* ignoré */
  }
}
