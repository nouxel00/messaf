import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, LogIn, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Champ } from '@/components/forms/Champ';
import { BandeauDemo } from '@/components/layout/BandeauDemo';
import { Alerte } from '@/components/ui/Alerte';
import { IconeChargement } from '@/components/ui/Chargeur';
import { Marque } from '@/components/ui/Marque';
import { config } from '@/config/env';
import { useAuth } from '@/contexts/AuthContext';
import { comptesDemo, MOT_DE_PASSE_DEMO } from '@/mocks/comptes-demo.mock';
import { messageErreur } from '@/services/errors';

const schema = z.object({
  identifiant: z.string().trim().min(1, "Saisissez votre identifiant."),
  motDePasse: z.string().min(1, 'Saisissez votre mot de passe.'),
});
type Valeurs = z.infer<typeof schema>;

function FormulaireDemo() {
  const { connecter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [erreur, setErreur] = useState<string>();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Valeurs>({ resolver: zodResolver(schema), defaultValues: { identifiant: '', motDePasse: '' } });

  const soumettre = handleSubmit(async (valeurs) => {
    setErreur(undefined);
    try {
      await connecter(valeurs);
      const depuis = (location.state as { depuis?: string } | null)?.depuis;
      navigate(depuis && depuis !== '/connexion' ? depuis : '/', { replace: true });
    } catch (e) {
      setErreur(messageErreur(e));
    }
  });

  const remplir = (identifiant: string) => {
    setValue('identifiant', identifiant, { shouldValidate: true });
    setValue('motDePasse', MOT_DE_PASSE_DEMO, { shouldValidate: true });
    setErreur(undefined);
  };

  return (
    <>
      <form onSubmit={soumettre} noValidate style={{ display: 'grid', gap: 18, marginTop: 24 }}>
        {erreur && (
          <Alerte ton="erreur" titre="Connexion refusée">
            {erreur}
          </Alerte>
        )}
        <Champ label="Identifiant" requis erreur={errors.identifiant?.message} aide="Votre matricule d'agent.">
          <input className="input" autoComplete="username" inputMode="numeric" {...register('identifiant')} />
        </Champ>
        <Champ label="Mot de passe" requis erreur={errors.motDePasse?.message}>
          <input className="input" type="password" autoComplete="current-password" {...register('motDePasse')} />
        </Champ>
        <button type="submit" className="btn btn-primaire btn-grand btn-bloc" disabled={isSubmitting}>
          {isSubmitting ? <IconeChargement /> : <LogIn size={18} aria-hidden />}
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <div className="alerte alerte-demo" style={{ marginTop: 24, display: 'block' }}>
        <p className="alerte-titre">Accès fictifs de démonstration</p>
        <p style={{ fontSize: 13 }}>
          Cette connexion n'est pas Keycloak. Mot de passe commun : <code>{MOT_DE_PASSE_DEMO}</code>. Cliquez sur un
          compte pour préremplir le formulaire.
        </p>
        <div className="comptes-demo">
          {comptesDemo.map((c) => (
            <button key={c.identifiant} type="button" className="compte-demo" onClick={() => remplir(c.identifiant)}>
              <span>
                <span className="compte-demo-nom" style={{ display: 'block' }}>
                  {c.nomComplet} · <code>{c.identifiant}</code>
                </span>
                <span className="compte-demo-usage">{c.usage}</span>
              </span>
              <UserCheck size={16} aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function ConnexionKeycloak() {
  const { connecter } = useAuth();
  const [erreur, setErreur] = useState<string>();
  const [encours, setEncours] = useState(false);

  const lancer = async () => {
    setErreur(undefined);
    setEncours(true);
    try {
      await connecter();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEncours(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 18, marginTop: 24 }}>
      {erreur && (
        <Alerte ton="attention" titre="Connexion indisponible">
          {erreur}
        </Alerte>
      )}
      <p style={{ fontSize: 14, color: 'var(--texte-doux)' }}>
        Vous allez être redirigé vers le service d'authentification MESSAF (Keycloak) pour saisir votre identifiant,
        votre mot de passe et votre second facteur. Le portail ne voit jamais votre mot de passe.
      </p>
      <button type="button" className="btn btn-primaire btn-grand btn-bloc" onClick={lancer} disabled={encours}>
        {encours ? <IconeChargement /> : <KeyRound size={18} aria-hidden />}
        Se connecter avec Keycloak
      </button>
    </div>
  );
}

export function ConnexionPage() {
  const { session, initialisation } = useAuth();
  if (!initialisation && session) return <Navigate to="/" replace />;

  return (
    <>
      <BandeauDemo />
      <div className="connexion">
        <section className="connexion-presentation">
          <Marque sousTitre="Messagerie Sécurisée de l'Administration du Faso" />
          <div>
            <h1>
              Portail d'administration — <span>Espace RH</span>
            </h1>
            <p>
              Enrôlement des agents publics dans MESSAF-BF : création de l'identité, du profil professionnel et de
              l'affectation, puis remise de la fiche d'enrôlement.
            </p>
          </div>
          <ul className="points-cles">
            <li>
              <ShieldCheck size={18} aria-hidden />
              <span>Espace réservé aux responsables RH habilités, limité à leur ministère.</span>
            </li>
            <li>
              <Users size={18} aria-hidden />
              <span>Aucune inscription libre : chaque compte d'agent est créé par un gestionnaire RH.</span>
            </li>
            <li>
              <KeyRound size={18} aria-hidden />
              <span>Le responsable RH ne peut pas consulter les conversations des agents.</span>
            </li>
          </ul>
        </section>
        <section className="connexion-formulaire">
          <div className="connexion-boite">
            <h2>Connexion</h2>
            <p>Accès réservé aux responsables RH autorisés.</p>
            {config.modeAuth === 'demo' ? <FormulaireDemo /> : <ConnexionKeycloak />}
          </div>
        </section>
      </div>
    </>
  );
}
