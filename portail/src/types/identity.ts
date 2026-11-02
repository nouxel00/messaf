/** Identité : la personne physique. Stockée dans Keycloak. Ne change jamais avec le poste. */
export interface CoordonneesProfessionnelles {
  email: string;
  telephone?: string;
}

export interface Identite {
  matricule: string;
  nom: string;
  prenoms: string;
  coordonnees: CoordonneesProfessionnelles;
}
