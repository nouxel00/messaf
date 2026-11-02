/** Erreur renvoyée par l'API (ou simulée par le mode démonstration). */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  /** Erreurs par champ, si le serveur les fournit. */
  readonly champs?: Record<string, string>;

  constructor(message: string, status: number, code?: string, champs?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.champs = champs;
  }
}

/** Fonction prévue dans le portail mais dont la route n'est pas encore définie dans le contrat. */
export class NonDisponibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonDisponibleError';
  }
}

export function messageErreur(erreur: unknown): string {
  if (erreur instanceof ApiError || erreur instanceof NonDisponibleError) return erreur.message;
  if (erreur instanceof TypeError) return "Le serveur est injoignable. Vérifiez la connexion ou l'adresse de l'API.";
  if (erreur instanceof Error) return erreur.message;
  return 'Une erreur inattendue est survenue.';
}
