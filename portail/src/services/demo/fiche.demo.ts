import { postesDemo, structuresDemo } from '@/mocks/organizations.mock';
import type { Agent } from '@/types/agent';
import { LIBELLES_HABILITATION } from '@/types/messaf';
import { formaterDate, formaterDateHeure, nomComplet } from '@/utils/format';

/**
 * Génère dans le navigateur une fiche d'enrôlement FICTIVE pour illustrer le rendu.
 * Elle ne contient aucun code d'activation : seul le serveur MESSAF pourra en produire un.
 */
export const MENTION_DEMONSTRATION = 'DOCUMENT DE DÉMONSTRATION — NON VALABLE POUR UN ENRÔLEMENT RÉEL';

const libelle = (code?: string) => structuresDemo.find((s) => s.code === code)?.libelle ?? code ?? '-';

export async function genererFicheDemo(agent: Agent): Promise<Blob> {
  // Chargé à la demande : jsPDF n'alourdit pas le reste du portail.
  const { jsPDF, GState } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();
  const marge = 18;
  // Les polices standard du PDF ne couvrent pas le tiret cadratin.
  const mention = MENTION_DEMONSTRATION.replace('—', '-');

  // Filigrane
  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.08 }));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(64);
  doc.setTextColor(200, 16, 46);
  // Texte incliné à 45° centré sur la page : on part du coin bas-gauche de sa diagonale.
  const diagonale = doc.getTextWidth('DÉMONSTRATION') * Math.SQRT1_2;
  doc.text('DÉMONSTRATION', (largeur - diagonale) / 2, (hauteur + diagonale) / 2, { angle: 45 });
  doc.restoreGraphicsState();

  // En-tête
  doc.setFillColor(0, 104, 55);
  doc.rect(0, 0, largeur, 26, 'F');
  doc.setFillColor(200, 16, 46);
  doc.rect(0, 26, largeur, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MESSAF-BF', marge, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text("Messagerie Sécurisée de l'Administration du Faso", marge, 18.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text("FICHE D'ENRÔLEMENT", largeur - marge, 15.5, { align: 'right' });

  // Bandeau de mention obligatoire
  let y = 36;
  doc.setFillColor(253, 236, 238);
  doc.setDrawColor(200, 16, 46);
  doc.setLineWidth(0.6);
  doc.roundedRect(marge, y, largeur - 2 * marge, 12, 1.5, 1.5, 'FD');
  doc.setTextColor(160, 10, 35);
  doc.setFontSize(10.5);
  doc.text(mention, largeur / 2, y + 7.6, { align: 'center' });
  y += 22;

  const section = (titre: string) => {
    doc.setTextColor(0, 104, 55);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(titre.toUpperCase(), marge, y);
    doc.setDrawColor(210, 214, 210);
    doc.setLineWidth(0.3);
    doc.line(marge, y + 2, largeur - marge, y + 2);
    y += 9;
  };
  const ligne = (etiquette: string, valeur: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(95, 102, 98);
    doc.text(etiquette, marge, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(25, 30, 28);
    const lignes = doc.splitTextToSize(valeur || '-', largeur - 2 * marge - 58);
    doc.text(lignes, marge + 58, y);
    y += 6.5 * lignes.length;
  };

  const { identite, profil, affectation } = agent;
  const poste = agent.poste ?? postesDemo.find((p) => p.code === affectation?.poste);

  section('1. Identité');
  ligne('Matricule', identite.matricule);
  ligne('Nom et prénoms', nomComplet(identite.nom, identite.prenoms));
  ligne('Courriel professionnel', identite.coordonnees.email);
  ligne('Téléphone professionnel', identite.coordonnees.telephone ?? '-');
  y += 4;

  section('2. Profil professionnel');
  ligne('Ministère', libelle(profil.ministere));
  ligne('Direction', libelle(profil.direction));
  ligne('Service', libelle(profil.service));
  y += 4;

  section('3. Poste et affectation');
  ligne('Poste', poste ? `${poste.intitule} (${poste.code})` : (affectation?.poste ?? '-'));
  ligne('Structure de rattachement', libelle(poste?.structure));
  ligne("Début d'affectation", formaterDate(affectation?.dateDebut));
  ligne("Fin d'affectation", affectation?.dateFin ? formaterDate(affectation.dateFin) : 'Non définie');
  y += 4;

  section('4. Compte MESSAF');
  ligne('Identifiant Matrix', agent.matrixId);
  ligne('Habilitation', `${LIBELLES_HABILITATION[agent.habilitation]} (${agent.habilitation})`);
  y += 6;

  // Encadré du code d'activation : volontairement vide
  doc.setDrawColor(150, 155, 152);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.roundedRect(marge, y, largeur - 2 * marge, 24, 2, 2, 'S');
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(25, 30, 28);
  doc.text("Code d'activation", marge + 6, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(95, 102, 98);
  doc.text(
    doc.splitTextToSize(
      "Aucun code n'est généré en démonstration. Le code d'activation réel sera produit uniquement par le serveur MESSAF (GET /agents/{matricule}/fiche-enrolement).",
      largeur - 2 * marge - 12,
    ),
    marge + 6,
    y + 14,
  );

  // Pied de page
  doc.setFontSize(8);
  doc.setTextColor(120, 125, 122);
  doc.text(`Généré par le portail en mode démonstration le ${formaterDateHeure(new Date().toISOString())}`, marge, hauteur - 16);
  doc.setTextColor(160, 10, 35);
  doc.setFont('helvetica', 'bold');
  doc.text(mention, marge, hauteur - 11);

  return doc.output('blob');
}
