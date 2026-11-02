/**
 * Affectation : rattachement d'une identité à un poste pour une période.
 * Stockée dans la base de l'API. Un changement de poste crée une nouvelle affectation,
 * jamais une nouvelle identité.
 */
export interface Affectation {
  /** Identité concernée (matricule). */
  matricule: string;
  /** Poste concerné (code). */
  poste: string;
  /** Date de début, format AAAA-MM-JJ. */
  dateDebut: string;
  /** Date de fin, format AAAA-MM-JJ, absente si inconnue. */
  dateFin?: string;
}
