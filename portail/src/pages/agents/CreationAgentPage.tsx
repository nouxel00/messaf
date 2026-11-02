import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EtapeHabilitation } from '@/components/agents/creation/EtapeHabilitation';
import { EtapeIdentite } from '@/components/agents/creation/EtapeIdentite';
import { EtapePosteAffectation } from '@/components/agents/creation/EtapePosteAffectation';
import { EtapeProfil } from '@/components/agents/creation/EtapeProfil';
import { EtapeRecapitulatif } from '@/components/agents/creation/EtapeRecapitulatif';
import { Etapes, type DefinitionEtape } from '@/components/agents/creation/Etapes';
import type { SectionAgent } from '@/components/agents/ResumeAgent';
import { Alerte } from '@/components/ui/Alerte';
import { Chargeur } from '@/components/ui/Chargeur';
import { ErreurChargement } from '@/components/ui/ErreurChargement';
import { useSession } from '@/contexts/AuthContext';
import { useReferentielRH } from '@/contexts/ReferentielContext';
import { agentsService } from '@/services/agents.service';
import type { NouvelAgent, ResultatCreationAgent } from '@/types/agent';
import type {
  ValeursHabilitation,
  ValeursIdentite,
  ValeursPosteAffectation,
  ValeursProfil,
} from '@/validation/agent.schemas';

const ETAPES: DefinitionEtape[] = [
  { titre: 'Identité', sousTitre: 'Matricule, nom, coordonnées' },
  { titre: 'Profil professionnel', sousTitre: 'Ministère, direction, service' },
  { titre: 'Poste et affectation', sousTitre: 'Fonction et période' },
  { titre: 'Habilitation', sousTitre: 'Niveau de classification' },
  { titre: 'Récapitulatif', sousTitre: 'Vérification et création' },
];

const DESCRIPTIONS = [
  "Qui est l'agent ? Ces informations identifient la personne physique.",
  "Où l'agent travaille-t-il ? Ce rattachement alimente l'annuaire MESSAF.",
  "Quelle fonction occupe-t-il, et depuis quand ? Le poste et l'affectation sont deux objets distincts.",
  "À quel niveau de messages classifiés l'agent peut-il accéder ?",
  'Contrôlez les informations avant de lancer la création du compte.',
];

const SECTION_VERS_ETAPE: Record<SectionAgent, number> = { identite: 0, profil: 1, poste: 2, habilitation: 3 };

interface Brouillon {
  identite?: ValeursIdentite;
  profil?: ValeursProfil;
  posteAffectation?: ValeursPosteAffectation;
  habilitation?: ValeursHabilitation;
}

/** Assemble les quatre objets du modèle sans les mélanger. */
function versNouvelAgent(b: Required<Brouillon>): NouvelAgent {
  return {
    identite: {
      matricule: b.identite.matricule,
      nom: b.identite.nom,
      prenoms: b.identite.prenoms,
      coordonnees: { email: b.identite.email, telephone: b.identite.telephone || undefined },
    },
    profil: {
      ministere: b.profil.ministere,
      direction: b.profil.direction,
      service: b.profil.service,
      annuaire: { afficherEmail: b.profil.afficherEmail, afficherTelephone: b.profil.afficherTelephone },
    },
    affectation: {
      poste: b.posteAffectation.poste,
      dateDebut: b.posteAffectation.dateDebut,
      dateFin: b.posteAffectation.dateFin || undefined,
    },
    habilitation: b.habilitation.habilitation,
  };
}

function complet(b: Brouillon): b is Required<Brouillon> {
  return !!(b.identite && b.profil && b.posteAffectation && b.habilitation);
}

export function CreationAgentPage() {
  const session = useSession();
  const navigate = useNavigate();
  const { referentiel, chargement, erreur, recharger } = useReferentielRH();
  const [brouillon, setBrouillon] = useState<Brouillon>({});
  const [courante, setCourante] = useState(0);
  const [atteinte, setAtteinte] = useState(0);
  /** Vrai quand l'utilisateur est revenu corriger une étape depuis le récapitulatif. */
  const retourRecap = useRef(false);
  const haut = useRef<HTMLDivElement>(null);

  // Ramène en haut du formulaire à chaque changement d'étape (pas au premier affichage).
  const premierAffichage = useRef(true);
  useEffect(() => {
    if (premierAffichage.current) {
      premierAffichage.current = false;
      return;
    }
    haut.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [courante]);

  const aller = (index: number) => setCourante(index);

  /** Enregistre une étape et passe à la suivante (ou revient au récapitulatif). */
  const valider = <K extends keyof Brouillon>(cle: K, index: number) => (valeurs: Brouillon[K]) => {
    const suivant = { ...brouillon, [cle]: valeurs };
    let plafond = Math.max(atteinte, index + 1);

    // Un profil modifié peut rendre le poste choisi invalide : il faudra repasser par l'étape Poste.
    if (cle === 'profil' && suivant.posteAffectation && referentiel) {
      const profil = valeurs as ValeursProfil;
      const poste = referentiel.poste(suivant.posteAffectation.poste);
      if (!poste || (poste.structure !== profil.service && poste.structure !== profil.direction)) {
        plafond = Math.min(plafond, 2);
        retourRecap.current = false;
      }
    }

    setBrouillon(suivant);
    setAtteinte(plafond);
    setCourante(retourRecap.current && complet(suivant) && plafond >= 4 ? 4 : index + 1);
    if (index + 1 >= 4) retourRecap.current = false;
  };

  const modifier = (section: SectionAgent) => {
    retourRecap.current = true;
    setCourante(SECTION_VERS_ETAPE[section]);
  };

  const cree = (resultat: ResultatCreationAgent) => {
    navigate(`/agents/${resultat.agent.identite.matricule}/creation-confirmee`, { replace: true, state: { resultat } });
  };

  const contenu = () => {
    if (chargement) return <Chargeur libelle="Chargement de l'organigramme…" />;
    if (erreur || !referentiel) return <ErreurChargement erreur={erreur} recharger={recharger} />;
    const precedent = () => setCourante((c) => Math.max(0, c - 1));

    switch (courante) {
      case 0:
        return <EtapeIdentite key="identite" valeurs={brouillon.identite} suivant={valider('identite', 0)} />;
      case 1:
        return (
          <EtapeProfil
            key="profil"
            valeurs={brouillon.profil}
            suivant={valider('profil', 1)}
            precedent={precedent}
            referentiel={referentiel}
            ministerePerimetre={session.ministere}
          />
        );
      case 2:
        return (
          <EtapePosteAffectation
            key="poste"
            valeurs={brouillon.posteAffectation}
            suivant={valider('posteAffectation', 2)}
            precedent={precedent}
            referentiel={referentiel}
            profil={brouillon.profil!}
            matricule={brouillon.identite!.matricule}
          />
        );
      case 3:
        return (
          <EtapeHabilitation
            key="habilitation"
            valeurs={brouillon.habilitation}
            suivant={valider('habilitation', 3)}
            precedent={precedent}
            poste={referentiel.poste(brouillon.posteAffectation?.poste)}
          />
        );
      default:
        return complet(brouillon) ? (
          <EtapeRecapitulatif
            nouvelAgent={versNouvelAgent(brouillon)}
            referentiel={referentiel}
            modifier={modifier}
            precedent={precedent}
            cree={cree}
          />
        ) : null;
    }
  };

  return (
    <>
      <div ref={haut} style={{ scrollMarginTop: 90 }} />
      <nav className="fil" aria-label="Fil d'Ariane">
        <Link to="/agents">Agents</Link>
        <ChevronRight size={14} aria-hidden />
        <span>Nouvel agent</span>
      </nav>
      <div className="page-entete">
        <div>
          <h1>Enregistrer un nouvel agent</h1>
          <p>Les champs marqués d'un astérisque (*) sont obligatoires.</p>
        </div>
      </div>

      {agentsService.simulation && (
        <Alerte ton="demo" className="" titre="Création simulée">
          Les informations restent dans ce navigateur. Astuce de test : un matricule commençant par 999 simule une
          erreur du serveur.
        </Alerte>
      )}

      <div className="creation mt">
        <Etapes etapes={ETAPES} courante={courante} atteinte={atteinte} aller={aller} />
        <section className="carte" aria-labelledby="titre-etape">
          <div className="carte-entete">
            <div>
              <p className="cellule-secondaire" style={{ fontWeight: 600 }}>
                Étape {courante + 1} sur {ETAPES.length}
              </p>
              <h2 id="titre-etape" style={{ fontSize: 19 }}>
                {ETAPES[courante]!.titre}
              </h2>
              <p style={{ color: 'var(--texte-doux)', fontSize: 14, marginTop: 2 }}>{DESCRIPTIONS[courante]}</p>
            </div>
          </div>
          <div className="carte-corps" style={{ paddingTop: 8 }}>
            {contenu()}
          </div>
        </section>
      </div>
    </>
  );
}
