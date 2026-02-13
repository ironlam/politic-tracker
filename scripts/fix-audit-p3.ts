/**
 * Fix script for Priority 3 audit issues (#72)
 *
 * 1. Fill missing party colors (11)
 * 2. Fill missing party descriptions (50)
 * 3. Fix remaining missing political positions (5)
 *
 * Usage:
 *   npx tsx scripts/fix-audit-p3.ts --dry-run
 *   npx tsx scripts/fix-audit-p3.ts
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { PoliticalPosition } from "../src/generated/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

// ── Missing colors ──────────────────────────────────────────
const PARTY_COLORS: Record<string, string> = {
  CDS: "#00A1DE", // Centre des démocrates sociaux — blue like UDF family
  CPNT: "#2E8B57", // Chasse — dark green (rural/hunting)
  FN: "#0D378A", // Front national — same blue as RN (predecessor)
  Jeanne: "#1C2951", // Micro-parti Le Pen — dark blue
  "L'APRÈS": "#7B68EE", // L'Après (Glucksmann) — purple
  PCB: "#DD0000", // Communiste breton — red
  PCI: "#DD0000", // Communiste internationaliste — red
  PCR: "#DD0000", // Communiste réunionnais — red
  PFN: "#1C2951", // Parti des forces nouvelles — dark blue
  PR: "#0072BB", // Parti républicain — blue
  REV: "#228B22", // Révolution écologique — green
};

// ── Missing political positions ─────────────────────────────
const MISSING_POSITIONS: Record<string, PoliticalPosition> = {
  LIOT: PoliticalPosition.CENTER, // Groupe centriste non-aligné
  RTLI: PoliticalPosition.CENTER_RIGHT, // Indépendants, centre-droit
  UDDPLR: PoliticalPosition.FAR_RIGHT, // Union des droites (Ciotti)
  UDR: PoliticalPosition.RIGHT, // Gaulliste
  // NI: pas de position (non-inscrits par définition)
};

// ── Party descriptions ──────────────────────────────────────
const PARTY_DESCRIPTIONS: Record<string, string> = {
  // Major current parties
  RN: "Parti politique français fondé en 1972 sous le nom de Front national, renommé en 2018. Classé à l'extrême droite, il défend un programme souverainiste, anti-immigration et eurosceptique.",
  LFI: "Mouvement politique fondé en 2016 par Jean-Luc Mélenchon. Positionné à la gauche radicale, il prône la désobéissance aux traités européens, la planification écologique et la VIe République.",
  RE: "Parti politique centriste fondé en 2016 par Emmanuel Macron sous le nom « En Marche ! », renommé Renaissance en 2022. Se positionne au-delà du clivage gauche-droite.",
  PS: "Parti socialiste fondé en 1969 (congrès d'Épinay en 1971). Historiquement le principal parti de gauche en France, il défend la social-démocratie et les valeurs républicaines.",
  LR: "Les Républicains, parti de centre-droit à droite fondé en 2015, successeur de l'UMP et du RPR. Défend le libéralisme économique, l'autorité de l'État et les valeurs conservatrices.",
  EELV: "Les Écologistes (anciennement Europe Écologie Les Verts). Principal parti écologiste français, fondé en 2010. Défend la transition écologique, la justice sociale et la démocratie participative.",
  PCF: "Parti communiste français, fondé en 1920 au congrès de Tours. L'un des plus anciens partis politiques français, il défend le marxisme, les services publics et les droits des travailleurs.",
  MoDem:
    "Mouvement Démocrate, parti centriste fondé en 2007 par François Bayrou. Se positionne au centre de l'échiquier politique, défend l'Europe et la démocratie sociale.",
  REC: "Reconquête, parti fondé en 2021 par Éric Zemmour. Classé à l'extrême droite, il défend un programme identitaire, anti-immigration et conservateur.",
  HOR: "Horizons, parti fondé en 2021 par Édouard Philippe. Positionné au centre-droit, il prône le réformisme, le sérieux budgétaire et l'Europe.",
  UDI: "Union des démocrates et indépendants, parti centriste fondé en 2012. Fédère plusieurs sensibilités du centre-droit.",
  PP: "Place publique, mouvement fondé en 2018 par Raphaël Glucksmann. Positionné au centre-gauche, il défend l'écologie sociale et l'Europe solidaire.",

  // Parliamentary groups
  EPR: "Groupe parlementaire Ensemble pour la République à l'Assemblée nationale, regroupant les députés macronistes (Renaissance, Horizons, MoDem).",
  DR: "Groupe parlementaire Droite Républicaine à l'Assemblée nationale, regroupant principalement les députés Les Républicains.",
  DEM: "Groupe parlementaire Démocrates à l'Assemblée nationale, regroupant les députés du Mouvement Démocrate et apparentés.",
  SOC: "Groupe parlementaire Socialiste, Écologiste et Républicain au Sénat, regroupant les sénateurs du Parti socialiste et apparentés.",
  ECOS: "Groupe parlementaire Écologiste et Social à l'Assemblée nationale, regroupant les députés écologistes et de gauche sociale.",
  GDR: "Groupe parlementaire Gauche Démocrate et Républicaine à l'Assemblée nationale, regroupant les députés communistes et républicains.",
  LIOT: "Groupe parlementaire Libertés, Indépendants, Outre-mer et Territoires à l'Assemblée nationale. Groupe transpartisan centré sur les territoires.",
  NI: "Non-inscrits : députés ou sénateurs n'appartenant à aucun groupe parlementaire.",
  RTLI: "Groupe parlementaire Les Indépendants – République et Territoires au Sénat. Regroupe des sénateurs de sensibilité centriste et centre-droit.",
  UC: "Groupe parlementaire Union Centriste au Sénat. Regroupe les sénateurs centristes (MoDem, UDI, Horizons et divers centre).",
  RDSE: "Groupe parlementaire Rassemblement Démocratique et Social Européen au Sénat. Regroupe des sénateurs radicaux et centristes.",
  CRC: "Groupe parlementaire Communiste Républicain Citoyen et Écologiste – Kanaky au Sénat.",
  GEST: "Groupe parlementaire Écologiste – Solidarité et Territoires au Sénat. Regroupe les sénateurs écologistes.",
  "LFI-NFP":
    "Groupe parlementaire La France insoumise – Nouveau Front Populaire à l'Assemblée nationale.",
  LREM: "Ancien nom du groupe parlementaire macroniste au Sénat (Rassemblement des démocrates, progressistes et indépendants).",
  UDR: "Groupe parlementaire Union des démocrates pour la République au Sénat, regroupant des sénateurs de droite gaulliste.",
  UDDPLR:
    "Groupe parlementaire Union des droites pour la République, créé en 2024 par Éric Ciotti après sa rupture avec Les Républicains.",
  IDL: "Micro-groupe Identité-Libertés, regroupant des élus issus du Rassemblement National et de Reconquête.",

  // Historical parties
  FN: "Ancien nom du Rassemblement National (jusqu'en 2018). Parti d'extrême droite fondé en 1972 par Jean-Marie Le Pen.",
  UMP: "Union pour un mouvement populaire (2002–2015). Principal parti de la droite française, successeur du RPR, prédécesseur des Républicains.",
  RPR: "Rassemblement pour la République (1976–2002). Parti gaulliste fondé par Jacques Chirac.",
  UDF: "Union pour la démocratie française (1978–2007). Confédération de partis centristes et libéraux, remplacée par le MoDem.",

  // Smaller parties
  Agir: "Agir, la droite constructive. Petit parti de centre-droit fondé en 2017, soutenant la majorité présidentielle.",
  NPA: "Nouveau Parti anticapitaliste, parti d'extrême gauche fondé en 2009, successeur de la Ligue communiste révolutionnaire.",
  GRS: "Gauche républicaine et socialiste, parti de gauche fondé en 2018 par Emmanuel Maurel et Marie-Noëlle Lienemann.",
  PG: "Parti de gauche, fondé en 2008 par Jean-Luc Mélenchon. Co-fondateur du Front de gauche.",
  PRG: "Parti radical de gauche (aujourd'hui Mouvement radical). Héritier du radicalisme, positionné au centre-gauche.",
  "G.s":
    "Génération.s, mouvement politique fondé en 2017 par Benoît Hamon après son départ du Parti socialiste.",
  MR: "Mouvement radical, issu de la fusion du Parti radical de gauche et du Parti radical valoisien en 2017.",
  REV: "Révolution écologique pour le vivant, mouvement fondé en 2018 par Aymeric Caron, défendant les droits des animaux et l'écologie radicale.",
  "L'APRÈS":
    "L'Après, mouvement politique co-fondé par Raphaël Glucksmann, associé à Place publique.",

  // Very small / historical
  CDS: "Centre des démocrates sociaux (1976–1995). Parti démocrate-chrétien, composante de l'UDF.",
  CPNT: "Chasse, Pêche, Nature et Traditions. Parti ruraliste fondé en 1989, défendant le monde rural et les traditions de chasse.",
  CNIP: "Centre national des indépendants et paysans. Parti de droite conservatrice fondé en 1949.",
  MNR: "Mouvement national républicain, parti d'extrême droite fondé en 1999 par Bruno Mégret après sa scission du Front national.",
  Jeanne: "Jeanne, micro-parti fondé en 2016 pour financer les campagnes de Marine Le Pen.",
  PFN: "Parti des forces nouvelles (1974–1990). Mouvement d'extrême droite concurrent du Front national.",
  PCB: "Parti communiste breton, petit parti communiste régionaliste actif en Bretagne.",
  PCI: "Parti communiste internationaliste, organisation trotskyste française.",
  PCR: "Parti communiste réunionnais, parti communiste actif à La Réunion, allié historique du PCF.",
  PR: "Parti républicain (1977–1997). Composante libérale de l'UDF, devenu Démocratie libérale.",
  PRV: "Parti radical valoisien, branche de droite du Parti radical historique.",
  "LR-hist": "Ancienne entrée pour Les Républicains (fusionnée avec LR).",
};

async function main() {
  console.log(`=== Fix Audit P3 — Party Enrichment ===`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // ── 1. Fill missing colors ──
  console.log("── 1. Missing party colors ──");
  let colorsSet = 0;
  for (const [shortName, color] of Object.entries(PARTY_COLORS)) {
    const party = await db.party.findFirst({
      where: { shortName, OR: [{ color: null }, { color: "" }] },
    });
    if (!party) continue;

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] ${shortName} → ${color}`);
    } else {
      await db.party.update({ where: { id: party.id }, data: { color } });
      console.log(`  ✓ ${shortName} → ${color}`);
    }
    colorsSet++;
  }
  console.log(`  Colors set: ${colorsSet}\n`);

  // ── 2. Fill missing descriptions ──
  console.log("── 2. Missing party descriptions ──");
  let descsSet = 0;
  let descsSkipped = 0;
  for (const [shortName, description] of Object.entries(PARTY_DESCRIPTIONS)) {
    const party = await db.party.findFirst({
      where: { shortName, OR: [{ description: null }, { description: "" }] },
    });
    if (!party) {
      descsSkipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] ${shortName}: "${description.substring(0, 60)}..."`);
    } else {
      await db.party.update({ where: { id: party.id }, data: { description } });
      console.log(`  ✓ ${shortName}`);
    }
    descsSet++;
  }
  console.log(`  Descriptions set: ${descsSet}, skipped (already had): ${descsSkipped}\n`);

  // ── 3. Fill remaining positions ──
  console.log("── 3. Missing political positions ──");
  let posSet = 0;
  for (const [shortName, position] of Object.entries(MISSING_POSITIONS)) {
    const party = await db.party.findFirst({
      where: { shortName, politicalPosition: null },
    });
    if (!party) continue;

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] ${shortName} → ${position}`);
    } else {
      await db.party.update({
        where: { id: party.id },
        data: { politicalPosition: position },
      });
      console.log(`  ✓ ${shortName} → ${position}`);
    }
    posSet++;
  }
  console.log(`  Positions set: ${posSet}\n`);

  // ── Summary ──
  console.log("=".repeat(50));
  console.log("Summary:");
  console.log(`  Colors: ${colorsSet}`);
  console.log(`  Descriptions: ${descsSet}`);
  console.log(`  Positions: ${posSet}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
