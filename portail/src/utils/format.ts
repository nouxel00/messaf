const formatDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
const formatDateHeure = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Date AAAA-MM-JJ (ou ISO) en toutes lettres, sans décalage de fuseau. */
export function formaterDate(valeur?: string): string {
  if (!valeur) return '—';
  const [a, m, j] = valeur.slice(0, 10).split('-').map(Number);
  if (!a || !m || !j) return valeur;
  return formatDate.format(new Date(a, m - 1, j));
}

export function formaterDateHeure(valeur?: string): string {
  if (!valeur) return '—';
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? valeur : formatDateHeure.format(date);
}

export function nomComplet(nom: string, prenoms: string): string {
  return `${prenoms} ${nom.toUpperCase()}`.trim();
}

/** Date du jour au format AAAA-MM-JJ, dans le fuseau local. */
export function aujourdhui(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const jj = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${jj}`;
}

/** Comparaison sans accents ni casse, pour la recherche. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
