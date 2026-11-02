import { z } from 'zod';
import { DESCRIPTION_FORMAT_MATRICULE, FORMAT_MATRICULE } from '@/config/messaf';
import { HABILITATIONS } from '@/types/messaf';

/**
 * Validation côté navigateur : elle guide la saisie mais ne sécurise rien.
 * L'API refera tous ces contrôles et reste seule juge.
 */

const NOM_PROPRE = /^[\p{L}][\p{L}\s'’-]*$/u;
const TELEPHONE = /^\+?[\d\s]{8,16}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const texteObligatoire = (manquant: string) => z.string().trim().min(1, manquant);

export const schemaIdentite = z.object({
  matricule: z
    .string()
    .trim()
    .min(1, 'Le matricule est obligatoire.')
    .regex(FORMAT_MATRICULE, `Matricule invalide : ${DESCRIPTION_FORMAT_MATRICULE}.`),
  nom: texteObligatoire('Le nom est obligatoire.')
    .max(80, '80 caractères au maximum.')
    .regex(NOM_PROPRE, 'Le nom ne doit contenir que des lettres, espaces, apostrophes ou tirets.'),
  prenoms: texteObligatoire('Le ou les prénoms sont obligatoires.')
    .max(120, '120 caractères au maximum.')
    .regex(NOM_PROPRE, 'Les prénoms ne doivent contenir que des lettres, espaces, apostrophes ou tirets.'),
  email: texteObligatoire('Le courriel professionnel est obligatoire.').pipe(
    z.email('Adresse de courriel invalide.'),
  ),
  telephone: z
    .string()
    .trim()
    .refine((v) => v === '' || TELEPHONE.test(v), 'Numéro invalide, par exemple +226 70 00 00 00.'),
});
export type ValeursIdentite = z.infer<typeof schemaIdentite>;

export const schemaProfil = z.object({
  ministere: texteObligatoire('Sélectionnez le ministère.'),
  direction: texteObligatoire('Sélectionnez la direction.'),
  service: texteObligatoire('Sélectionnez le service.'),
  afficherEmail: z.boolean(),
  afficherTelephone: z.boolean(),
});
export type ValeursProfil = z.infer<typeof schemaProfil>;

export const schemaPosteAffectation = z
  .object({
    poste: texteObligatoire('Sélectionnez le poste occupé.'),
    dateDebut: texteObligatoire("La date de début d'affectation est obligatoire.").regex(DATE, 'Date invalide.'),
    dateFin: z.string().trim().refine((v) => v === '' || DATE.test(v), 'Date invalide.'),
  })
  .refine((v) => v.dateFin === '' || v.dateFin > v.dateDebut, {
    path: ['dateFin'],
    message: 'La date de fin doit être postérieure à la date de début.',
  });
export type ValeursPosteAffectation = z.infer<typeof schemaPosteAffectation>;

export const schemaHabilitation = z.object({
  habilitation: z.enum(HABILITATIONS, { error: 'Sélectionnez un niveau d’habilitation.' }),
});
export type ValeursHabilitation = z.infer<typeof schemaHabilitation>;
