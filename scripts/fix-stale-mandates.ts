#!/usr/bin/env tsx
/**
 * Fix Stale Mandates
 *
 * Cleans up mandates still marked isCurrent: true that should be closed.
 *
 * Usage:
 *   npx tsx scripts/fix-stale-mandates.ts              # Dry run (all)
 *   npx tsx scripts/fix-stale-mandates.ts --apply       # Apply changes
 *   npx tsx scripts/fix-stale-mandates.ts --senators    # Senators only
 *   npx tsx scripts/fix-stale-mandates.ts --deputies    # Deputies only
 *   npx tsx scripts/fix-stale-mandates.ts --parties     # Party cleanup only
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { MandateType, DataSource } from "../src/generated/prisma";
import { politicianService } from "../src/services/politician";
import { HTTPClient } from "../src/lib/api/http-client";
import { SENATE_GROUPS, ASSEMBLY_GROUPS } from "../src/config/parliamentaryGroups";

const client = new HTTPClient({ rateLimitMs: 500 });

// ============================================
// SENATE SERIES MAPPING
// ============================================

const SERIE_1_END_DATE = new Date("2023-10-01");
const SERIE_2_END_DATE = new Date("2020-10-01");

// Departments in Série 1 (renewed September 2023)
const SERIE_1_DEPARTMENTS = new Set([
  "01",
  "03",
  "06",
  "08",
  "09",
  "11",
  "13",
  "15",
  "17",
  "19",
  "2A",
  "22",
  "24",
  "26",
  "28",
  "30",
  "32",
  "34",
  "36",
  "38",
  "40",
  "42",
  "44",
  "46",
  "48",
  "50",
  "52",
  "54",
  "56",
  "58",
  "60",
  "62",
  "64",
  "66",
  "68",
  "70",
  "72",
  "74",
  "76",
  "78",
  "80",
  "82",
  "84",
  "86",
  "88",
  "90",
  "92",
  "94",
  "971",
  "973",
  "976",
  "986",
  "988",
]);

function getSerieEndDate(departmentCode: string | null, constituency: string | null): Date {
  if (constituency) {
    const serieMatch = constituency.match(/Série\s+(\d)/i);
    if (serieMatch) {
      return serieMatch[1] === "1" ? SERIE_1_END_DATE : SERIE_2_END_DATE;
    }
  }
  if (departmentCode) {
    return SERIE_1_DEPARTMENTS.has(departmentCode) ? SERIE_1_END_DATE : SERIE_2_END_DATE;
  }
  return SERIE_1_END_DATE;
}

// ============================================
// TYPES
// ============================================

interface Stats {
  senatorsClosed: number;
  deputiesClosed: number;
  pmClosed: number;
  phantomsClosed: number;
  doubleMandatesClosed: number;
  partiesFixed: number;
  errors: string[];
}

// ============================================
// FIX: STALE SENATORS
// ============================================

async function fixStaleSenators(stats: Stats, apply: boolean) {
  console.log("── Sénateurs ──────────────────────────────");

  const { data: apiSenators } = await client.get<{ matricule: string }[]>(
    "https://www.senat.fr/api-senat/senateurs.json"
  );
  const apiMatricules = new Set(apiSenators.map((s) => s.matricule));
  console.log(`  API senat.fr: ${apiMatricules.size} sénateurs actuels`);

  const dbMandates = await db.mandate.findMany({
    where: { type: MandateType.SENATEUR, isCurrent: true },
    include: {
      politician: {
        select: {
          id: true,
          fullName: true,
          externalIds: {
            where: { source: DataSource.SENAT },
            select: { externalId: true },
          },
        },
      },
    },
  });
  console.log(`  DB: ${dbMandates.length} mandats sénatoriaux isCurrent=true`);

  for (const mandate of dbMandates) {
    const senatId = mandate.politician.externalIds[0]?.externalId;

    if (!senatId || !apiMatricules.has(senatId)) {
      const endDate = getSerieEndDate(mandate.departmentCode, mandate.constituency);
      console.log(
        `  ✗ ${mandate.politician.fullName} (${senatId || "no senat ID"}) → fermé au ${endDate.toISOString().split("T")[0]}`
      );

      if (apply) {
        await db.mandate.update({
          where: { id: mandate.id },
          data: { isCurrent: false, endDate },
        });
      }
      stats.senatorsClosed++;
    }
  }

  console.log(`  → ${stats.senatorsClosed} mandats à fermer\n`);
}

// ============================================
// FIX: STALE DEPUTIES
// ============================================

async function fixStaleDeputies(stats: Stats, apply: boolean) {
  console.log("── Députés ────────────────────────────────");

  const legislatureStartDate = new Date("2024-07-08");

  let apiSlugs: Set<string>;
  try {
    const { data } = await client.get<
      { deputes: { depute: { slug: string } }[] } | Record<string, unknown>
    >("https://www.nosdeputes.fr/deputes/json");

    const raw = data as { deputes?: { depute: { slug: string } }[] };
    const deputies = raw.deputes ? raw.deputes.map((d) => d.depute) : [];
    apiSlugs = new Set(deputies.map((d) => d.slug).filter(Boolean));
    console.log(`  API NosDéputés: ${apiSlugs.size} députés actuels`);
  } catch (error) {
    console.warn("  ⚠ Could not fetch NosDéputés API, skipping");
    stats.errors.push(`Deputies API: ${error}`);
    return;
  }

  const dbMandates = await db.mandate.findMany({
    where: { type: MandateType.DEPUTE, isCurrent: true },
    include: {
      politician: {
        select: {
          id: true,
          fullName: true,
          slug: true,
          externalIds: {
            where: { source: DataSource.NOSDEPUTES },
            select: { externalId: true },
          },
        },
      },
    },
  });
  console.log(`  DB: ${dbMandates.length} mandats de député isCurrent=true`);

  for (const mandate of dbMandates) {
    const ndSlug = mandate.politician.externalIds[0]?.externalId || mandate.politician.slug;

    if (!apiSlugs.has(ndSlug)) {
      if (mandate.startDate && mandate.startDate < legislatureStartDate) {
        console.log(
          `  ✗ ${mandate.politician.fullName} (${ndSlug}) → fermé au ${legislatureStartDate.toISOString().split("T")[0]}`
        );

        if (apply) {
          await db.mandate.update({
            where: { id: mandate.id },
            data: { isCurrent: false, endDate: legislatureStartDate },
          });
        }
        stats.deputiesClosed++;
      }
    }
  }

  console.log(`  → ${stats.deputiesClosed} mandats à fermer\n`);
}

// ============================================
// FIX: DOUBLE PREMIER MINISTRE
// ============================================

async function fixDoublePM(stats: Stats, apply: boolean) {
  console.log("── Premiers ministres ─────────────────────");

  const pmMandates = await db.mandate.findMany({
    where: { type: MandateType.PREMIER_MINISTRE, isCurrent: true },
    include: { politician: { select: { fullName: true } } },
    orderBy: { startDate: "desc" },
  });

  if (pmMandates.length <= 1) {
    console.log("  ✓ Un seul PM actuel\n");
    return;
  }

  const [current, ...stale] = pmMandates;
  console.log(
    `  ✓ PM actuel: ${current.politician.fullName} (${current.startDate?.toISOString().split("T")[0]})`
  );

  for (const mandate of stale) {
    const endDate = current.startDate || new Date();
    console.log(
      `  ✗ ${mandate.politician.fullName} (${mandate.startDate?.toISOString().split("T")[0]}) → fermé au ${endDate.toISOString().split("T")[0]}`
    );
    if (apply) {
      await db.mandate.update({
        where: { id: mandate.id },
        data: { isCurrent: false, endDate },
      });
    }
    stats.pmClosed++;
  }
  console.log(`  → ${stats.pmClosed} mandats PM à fermer\n`);
}

// ============================================
// FIX: PHANTOM MANDATES (pre-1958)
// ============================================

async function fixPhantomMandates(stats: Stats, apply: boolean) {
  console.log("── Mandats fantômes (avant 1958) ──────────");

  const cutoffDate = new Date("1958-01-01");
  const phantoms = await db.mandate.findMany({
    where: { isCurrent: true, startDate: { lt: cutoffDate } },
    include: { politician: { select: { fullName: true } } },
  });

  for (const mandate of phantoms) {
    console.log(
      `  ✗ ${mandate.politician.fullName}: ${mandate.title} (${mandate.startDate?.toISOString().split("T")[0]})`
    );
    if (apply) {
      await db.mandate.update({
        where: { id: mandate.id },
        data: { isCurrent: false, endDate: mandate.startDate || cutoffDate },
      });
    }
    stats.phantomsClosed++;
  }
  console.log(`  → ${stats.phantomsClosed} mandats fantômes à fermer\n`);
}

// ============================================
// FIX: DOUBLE PARLIAMENTARY MANDATES
// ============================================

async function fixDoubleMandates(stats: Stats, apply: boolean) {
  console.log("── Double mandats parlementaires ───────────");

  const parliamentaryTypes = [MandateType.DEPUTE, MandateType.SENATEUR];

  const politicians = await db.politician.findMany({
    where: {
      mandates: {
        some: { type: { in: parliamentaryTypes }, isCurrent: true },
      },
    },
    include: {
      mandates: {
        where: { type: { in: parliamentaryTypes }, isCurrent: true },
        orderBy: { startDate: "desc" },
      },
    },
  });

  for (const pol of politicians) {
    if (pol.mandates.length <= 1) continue;

    const [current, ...stale] = pol.mandates;
    console.log(
      `  ${pol.fullName}: garde ${current.type} (${current.startDate?.toISOString().split("T")[0]})`
    );

    for (const mandate of stale) {
      const endDate = current.startDate || new Date();
      console.log(
        `    ✗ ferme ${mandate.type} (${mandate.startDate?.toISOString().split("T")[0]}) → ${endDate.toISOString().split("T")[0]}`
      );
      if (apply) {
        await db.mandate.update({
          where: { id: mandate.id },
          data: { isCurrent: false, endDate },
        });
      }
      stats.doubleMandatesClosed++;
    }
  }
  console.log(`  → ${stats.doubleMandatesClosed} double mandats à fermer\n`);
}

// ============================================
// FIX: MISSING PARTIES
// ============================================

async function fixMissingParties(stats: Stats, apply: boolean) {
  console.log("── Politiciens sans parti ──────────────────");

  const politicians = await db.politician.findMany({
    where: {
      currentPartyId: null,
      mandates: {
        some: {
          isCurrent: true,
          type: {
            in: [MandateType.DEPUTE, MandateType.SENATEUR, MandateType.DEPUTE_EUROPEEN],
          },
        },
      },
    },
    include: {
      mandates: {
        where: { isCurrent: true },
        select: { type: true, parliamentaryGroupId: true },
      },
      externalIds: {
        where: { source: { in: [DataSource.SENAT, DataSource.NOSDEPUTES] } },
        select: { source: true, externalId: true },
      },
    },
  });

  console.log(`  ${politicians.length} politiciens avec mandat actuel sans parti`);

  // Senat.fr API uses different group codes than our config
  const SENAT_API_CODE_TO_CONFIG: Record<string, string> = {
    LREM: "RDPI",
    UMP: "LR",
    CRC: "CRCE-K",
    SOC: "SER",
    RTLI: "INDEP",
    // GEST, RDSE, UC, NI match directly
  };

  // Build senator matricule → group config key map from senat.fr API
  let senatorGroupMap = new Map<string, string>();
  try {
    const { data: apiSenators } = await client.get<
      { matricule: string; groupe?: { code: string } }[]
    >("https://www.senat.fr/api-senat/senateurs.json");
    for (const sen of apiSenators) {
      if (sen.groupe?.code) {
        const configKey = SENAT_API_CODE_TO_CONFIG[sen.groupe.code] || sen.groupe.code;
        senatorGroupMap.set(sen.matricule, configKey);
      }
    }
    console.log(`  API senat.fr: ${senatorGroupMap.size} sénateurs avec groupe`);
  } catch {
    console.warn("  ⚠ Could not fetch senat.fr API for group mapping");
  }

  // Build party Wikidata ID → DB party ID cache
  const partyCache = new Map<string, string>();
  async function resolvePartyByWikidata(wikidataId: string): Promise<string | null> {
    if (partyCache.has(wikidataId)) return partyCache.get(wikidataId)!;
    const extId = await db.externalId.findFirst({
      where: {
        source: DataSource.WIKIDATA,
        externalId: wikidataId,
        partyId: { not: null },
      },
      select: { partyId: true },
    });
    if (extId?.partyId) {
      partyCache.set(wikidataId, extId.partyId);
      return extId.partyId;
    }
    return null;
  }

  // Also try resolving via defaultPartyId on parliamentary groups in DB
  const groupPartyMap = new Map<string, string>();
  const groups = await db.parliamentaryGroup.findMany({
    where: { defaultPartyId: { not: null } },
    select: { id: true, code: true, defaultPartyId: true },
  });
  for (const g of groups) {
    if (g.defaultPartyId) groupPartyMap.set(g.id, g.defaultPartyId);
  }

  for (const pol of politicians) {
    let resolved = false;

    // Strategy 1: Parliamentary group on mandate (if available)
    for (const mandate of pol.mandates) {
      if (mandate.parliamentaryGroupId && groupPartyMap.has(mandate.parliamentaryGroupId)) {
        const partyId = groupPartyMap.get(mandate.parliamentaryGroupId)!;
        console.log(`  ✓ ${pol.fullName} → parti via groupe en base`);
        if (apply) await politicianService.setCurrentParty(pol.id, partyId);
        stats.partiesFixed++;
        resolved = true;
        break;
      }
    }
    if (resolved) continue;

    // Strategy 2: Senator → senat.fr API → group code → SENATE_GROUPS config
    const senatExtId = pol.externalIds.find((e) => e.source === DataSource.SENAT);
    if (senatExtId) {
      const groupCode = senatorGroupMap.get(senatExtId.externalId);
      if (groupCode) {
        const config = SENATE_GROUPS[groupCode];
        if (config?.partyWikidataId) {
          const partyId = await resolvePartyByWikidata(config.partyWikidataId);
          if (partyId) {
            console.log(`  ✓ ${pol.fullName} → parti via API senat groupe ${groupCode}`);
            if (apply) await politicianService.setCurrentParty(pol.id, partyId);
            stats.partiesFixed++;
            continue;
          }
        }
        // Group exists but no party mapping (transpartisan groups like UC, RDSE, INDEP)
        console.log(`  ? ${pol.fullName} → groupe ${groupCode} (transpartisan, pas de parti)`);
        continue;
      }
    }

    console.log(`  ? ${pol.fullName} → pas de groupe résolvable`);
  }

  console.log(`  → ${stats.partiesFixed} partis corrigés\n`);
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const onlySenators = args.includes("--senators");
  const onlyDeputies = args.includes("--deputies");
  const onlyParties = args.includes("--parties");
  const runAll = !onlySenators && !onlyDeputies && !onlyParties;

  console.log(`\n🔧 Fix Stale Mandates ${apply ? "(APPLYING)" : "(DRY RUN)"}\n`);

  const stats: Stats = {
    senatorsClosed: 0,
    deputiesClosed: 0,
    pmClosed: 0,
    phantomsClosed: 0,
    doubleMandatesClosed: 0,
    partiesFixed: 0,
    errors: [],
  };

  if (runAll || onlySenators) await fixStaleSenators(stats, apply);
  if (runAll || onlyDeputies) await fixStaleDeputies(stats, apply);
  if (runAll) await fixDoublePM(stats, apply);
  if (runAll) await fixPhantomMandates(stats, apply);
  if (runAll) await fixDoubleMandates(stats, apply);
  if (runAll || onlyParties) await fixMissingParties(stats, apply);

  console.log("=".repeat(50));
  console.log("📊 Summary\n");
  console.log(`Sénateurs fermés: ${stats.senatorsClosed}`);
  console.log(`Députés fermés: ${stats.deputiesClosed}`);
  console.log(`PM fermés: ${stats.pmClosed}`);
  console.log(`Fantômes fermés: ${stats.phantomsClosed}`);
  console.log(`Double mandats fermés: ${stats.doubleMandatesClosed}`);
  console.log(`Partis corrigés: ${stats.partiesFixed}`);
  if (stats.errors.length > 0) {
    console.log(`\nErreurs: ${stats.errors.length}`);
    for (const e of stats.errors.slice(0, 10)) console.log(`  - ${e}`);
  }
  if (!apply) {
    console.log("\n⚠️  Dry run. Utilisez --apply pour appliquer les changements.");
  }
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
