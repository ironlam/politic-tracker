/**
 * Quick Wikidata lookup tool
 *
 * Usage:
 *   npm run wikidata:lookup -- "Mélenchon"           # Search by name
 *   npm run wikidata:lookup -- Q3321510               # Get entity details
 *   npm run wikidata:lookup -- Q3321510 --positions   # Show P39 positions
 *   npm run wikidata:lookup -- Q3321510 --party       # Show P102 party
 *   npm run wikidata:lookup -- Q170972 --chairperson  # Show P488 chairperson
 */

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

interface SearchResult {
  id: string;
  label: string;
  description?: string;
}

async function search(query: string): Promise<SearchResult[]> {
  const url = `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(query)}&language=fr&type=item&limit=10&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.search || []).map((s: { id: string; label: string; description?: string }) => ({
    id: s.id,
    label: s.label,
    description: s.description,
  }));
}

async function getEntity(id: string) {
  const url = `${WIKIDATA_API}?action=wbgetentities&ids=${id}&props=labels|descriptions|claims&languages=fr|en&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  return data.entities?.[id];
}

function getLabel(entity: { labels?: Record<string, { value: string }> }): string {
  return entity.labels?.fr?.value || entity.labels?.en?.value || "?";
}

function getDescription(entity: { descriptions?: Record<string, { value: string }> }): string {
  return entity.descriptions?.fr?.value || entity.descriptions?.en?.value || "";
}

function extractEntityId(
  claim: { mainsnak?: { datavalue?: { value?: { id?: string } } } } | undefined
): string | undefined {
  const val = claim?.mainsnak?.datavalue?.value;
  if (val && typeof val === "object" && "id" in val) return val.id;
  return undefined;
}

function extractTime(
  claim: { mainsnak?: { datavalue?: { value?: { time?: string } } } } | undefined
): string | undefined {
  const val = claim?.mainsnak?.datavalue?.value;
  if (val && typeof val === "object" && "time" in val) {
    return (val.time as string).replace(/^\+/, "").split("T")[0];
  }
  return undefined;
}

function extractQualifier(
  qualifiers:
    | Record<string, Array<{ datavalue?: { value?: { id?: string; time?: string } } }>>
    | undefined,
  prop: string
): string | undefined {
  const q = qualifiers?.[prop]?.[0]?.datavalue?.value;
  if (!q) return undefined;
  if (typeof q === "object" && "id" in q) return q.id;
  if (typeof q === "object" && "time" in q)
    return (q.time as string).replace(/^\+/, "").split("T")[0];
  return undefined;
}

async function resolveLabels(ids: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  if (ids.length === 0) return labels;

  const unique = [...new Set(ids)];
  // Batch by 50
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const url = `${WIKIDATA_API}?action=wbgetentities&ids=${batch.join("|")}&props=labels&languages=fr|en&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    for (const [id, entity] of Object.entries(data.entities || {})) {
      labels.set(id, getLabel(entity as { labels?: Record<string, { value: string }> }));
    }
  }
  return labels;
}

async function showPositions(entity: { claims?: Record<string, Array<Record<string, unknown>>> }) {
  const claims = entity.claims?.P39;
  if (!claims || claims.length === 0) {
    console.log("  (aucune position P39)");
    return;
  }

  // Collect all referenced IDs for label resolution
  const refIds: string[] = [];
  for (const claim of claims) {
    const posId = extractEntityId(
      claim as { mainsnak?: { datavalue?: { value?: { id?: string } } } }
    );
    if (posId) refIds.push(posId);
    const qualifiers = (
      claim as { qualifiers?: Record<string, Array<{ datavalue?: { value?: { id?: string } } }>> }
    ).qualifiers;
    const ofId = extractQualifier(
      qualifiers as Record<
        string,
        Array<{ datavalue?: { value?: { id?: string; time?: string } } }>
      >,
      "P642"
    );
    if (ofId) refIds.push(ofId);
    const partyId = extractQualifier(
      qualifiers as Record<
        string,
        Array<{ datavalue?: { value?: { id?: string; time?: string } } }>
      >,
      "P102"
    );
    if (partyId) refIds.push(partyId);
    const pgId = extractQualifier(
      qualifiers as Record<
        string,
        Array<{ datavalue?: { value?: { id?: string; time?: string } } }>
      >,
      "P4100"
    );
    if (pgId) refIds.push(pgId);
  }

  const labels = await resolveLabels(refIds);

  for (const claim of claims) {
    const posId = extractEntityId(
      claim as { mainsnak?: { datavalue?: { value?: { id?: string } } } }
    );
    if (!posId) continue;
    const qualifiers = (
      claim as {
        qualifiers?: Record<
          string,
          Array<{ datavalue?: { value?: { id?: string; time?: string } } }>
        >;
      }
    ).qualifiers;
    const start =
      extractQualifier(
        qualifiers as Record<
          string,
          Array<{ datavalue?: { value?: { id?: string; time?: string } } }>
        >,
        "P580"
      ) || "?";
    const end =
      extractQualifier(
        qualifiers as Record<
          string,
          Array<{ datavalue?: { value?: { id?: string; time?: string } } }>
        >,
        "P582"
      ) || "en cours";
    const ofId = extractQualifier(
      qualifiers as Record<
        string,
        Array<{ datavalue?: { value?: { id?: string; time?: string } } }>
      >,
      "P642"
    );
    const partyId = extractQualifier(
      qualifiers as Record<
        string,
        Array<{ datavalue?: { value?: { id?: string; time?: string } } }>
      >,
      "P102"
    );
    const pgId = extractQualifier(
      qualifiers as Record<
        string,
        Array<{ datavalue?: { value?: { id?: string; time?: string } } }>
      >,
      "P4100"
    );

    let line = `  ${posId} ${labels.get(posId) || "?"} (${start} → ${end})`;
    if (ofId) line += ` | of: ${ofId} ${labels.get(ofId) || ""}`;
    if (partyId) line += ` | parti: ${partyId} ${labels.get(partyId) || ""}`;
    if (pgId) line += ` | groupe: ${pgId} ${labels.get(pgId) || ""}`;
    console.log(line);
  }
}

async function showChairperson(entity: {
  claims?: Record<string, Array<Record<string, unknown>>>;
}) {
  const claims = entity.claims?.P488;
  if (!claims || claims.length === 0) {
    console.log("  (aucun chairperson P488)");
    return;
  }

  const refIds: string[] = [];
  for (const claim of claims) {
    const id = extractEntityId(claim as { mainsnak?: { datavalue?: { value?: { id?: string } } } });
    if (id) refIds.push(id);
  }

  const labels = await resolveLabels(refIds);

  for (const claim of claims) {
    const id = extractEntityId(claim as { mainsnak?: { datavalue?: { value?: { id?: string } } } });
    if (!id) continue;
    const qualifiers = (
      claim as {
        qualifiers?: Record<
          string,
          Array<{ datavalue?: { value?: { id?: string; time?: string } } }>
        >;
      }
    ).qualifiers;
    const start =
      extractQualifier(
        qualifiers as Record<
          string,
          Array<{ datavalue?: { value?: { id?: string; time?: string } } }>
        >,
        "P580"
      ) || "?";
    const end =
      extractQualifier(
        qualifiers as Record<
          string,
          Array<{ datavalue?: { value?: { id?: string; time?: string } } }>
        >,
        "P582"
      ) || "en cours";
    console.log(`  ${id} ${labels.get(id) || "?"} (${start} → ${end})`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const query = args.find((a) => !a.startsWith("--"));
  const showPos = args.includes("--positions") || args.includes("-p");
  const showParty = args.includes("--party");
  const showChair = args.includes("--chairperson") || args.includes("--chair");
  const showAll = args.includes("--all") || args.includes("-a");

  if (!query) {
    console.log(`Usage:
  npx tsx scripts/wikidata-lookup.ts "Mélenchon"           # Search by name
  npx tsx scripts/wikidata-lookup.ts Q3321510              # Get entity details
  npx tsx scripts/wikidata-lookup.ts Q3321510 --positions  # Show P39 positions
  npx tsx scripts/wikidata-lookup.ts Q3321510 --party      # Show P102 party
  npx tsx scripts/wikidata-lookup.ts Q170972 --chairperson # Show P488 chairperson
  npx tsx scripts/wikidata-lookup.ts Q3321510 --all        # Show everything`);
    return;
  }

  // If it looks like a Q-ID, fetch directly
  if (/^Q\d+$/.test(query)) {
    const entity = await getEntity(query);
    if (!entity) {
      console.log(`Entity ${query} not found`);
      return;
    }

    console.log(`\n${query} — ${getLabel(entity)}`);
    console.log(`  ${getDescription(entity)}`);
    console.log(`  https://www.wikidata.org/wiki/${query}`);

    if (showPos || showAll) {
      console.log("\nPositions (P39):");
      await showPositions(entity);
    }

    if (showParty || showAll) {
      const partyClaims = entity.claims?.P102;
      if (partyClaims) {
        const ids = partyClaims
          .map((c: Record<string, unknown>) =>
            extractEntityId(c as { mainsnak?: { datavalue?: { value?: { id?: string } } } })
          )
          .filter(Boolean);
        const labels = await resolveLabels(ids as string[]);
        console.log("\nParti politique (P102):");
        for (const id of ids) {
          console.log(`  ${id} ${labels.get(id as string) || "?"}`);
        }
      }
    }

    if (showChair || showAll) {
      console.log("\nChairperson (P488):");
      await showChairperson(entity);
    }

    return;
  }

  // Otherwise, search by name
  console.log(`\nRecherche "${query}"...\n`);
  const results = await search(query);

  if (results.length === 0) {
    console.log("Aucun résultat.");
    return;
  }

  for (const r of results) {
    console.log(`  ${r.id.padEnd(12)} ${r.label}${r.description ? ` — ${r.description}` : ""}`);
  }
  console.log(`\nPour plus de détails: npx tsx scripts/wikidata-lookup.ts ${results[0].id} --all`);
}

main().catch(console.error);
