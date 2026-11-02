/**
 * Profil professionnel : l'environnement administratif de la personne.
 * Stocké dans les attributs Keycloak `ministere`, `direction`, `service`.
 */
export interface VisibiliteAnnuaire {
  afficherEmail: boolean;
  afficherTelephone: boolean;
}

export interface ProfilProfessionnel {
  /** Code de structure du ministère (attribut Keycloak `ministere`). */
  ministere: string;
  /** Code de structure de la direction (attribut Keycloak `direction`). */
  direction: string;
  /** Code de structure du service (attribut Keycloak `service`). */
  service: string;
  annuaire: VisibiliteAnnuaire;
}
