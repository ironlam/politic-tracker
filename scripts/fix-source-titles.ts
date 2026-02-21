/**
 * One-off fix: scrape real article titles for PRESSE sources
 * that got the affair title instead of the article title.
 *
 * Usage:
 *   npx tsx scripts/fix-source-titles.ts [--dry-run] [--limit=N] [--verbose]
 */

import { db } from "../src/lib/db";
import { JSDOM } from "jsdom";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const VERBOSE = args.includes("--verbose");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1]) : undefined;

const FETCH_TIMEOUT = 10_000;
const DELAY_MS = 300; // polite delay between fetches

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Extract og:title or <title> from a URL without full Readability parsing.
 */
async function fetchArticleTitle(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Poligraph/1.0; +https://poligraph.fr)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: "follow",
    });

    if (!response.ok) return null;

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    // Prefer og:title (most reliable for article titles)
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content");
    if (ogTitle && ogTitle.trim().length > 5) return ogTitle.trim();

    // Fallback to <title> tag, strip site name suffix
    const titleTag = doc.querySelector("title")?.textContent;
    if (titleTag && titleTag.trim().length > 5) {
      // Remove common suffixes like " - Le Monde", " | L'Obs"
      return titleTag
        .trim()
        .replace(
          /\s*[|–—-]\s*(Le Monde|Le Figaro|Libération|L'Obs|France Info|Mediapart|Public Sénat|Le Point|L'Express|France 24|20 Minutes|BFMTV|La Croix|Ouest-France|Sud Ouest|La Dépêche|Le Parisien|Les Échos|Challenges|L'Humanité|Courrier international|Le Courrier Cauchois|Paris-Normandie|L'Indépendant|France Bleu|franceinfo|france 3).*$/i,
          ""
        )
        .trim();
    }

    return null;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`Fix source titles${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log("=".repeat(50));

  // Find all affairs where multiple PRESSE sources share the same title
  const affairs = await db.affair.findMany({
    where: {
      sources: {
        some: { sourceType: "PRESSE" },
      },
    },
    include: {
      sources: {
        where: { sourceType: "PRESSE" },
        select: { id: true, url: true, title: true, publisher: true },
      },
    },
  });

  // Collect sources that need fixing: all PRESSE sources in an affair
  // where every source has the same title (= the affair title)
  const sourcesToFix: {
    id: string;
    url: string;
    currentTitle: string;
    publisher: string | null;
  }[] = [];

  for (const affair of affairs) {
    if (affair.sources.length < 2) continue;
    const titles = new Set(affair.sources.map((s) => s.title));
    if (titles.size === 1) {
      // All sources have the same title — they need fixing
      for (const s of affair.sources) {
        sourcesToFix.push({
          id: s.id,
          url: s.url,
          currentTitle: s.title,
          publisher: s.publisher,
        });
      }
    }
  }

  console.log(`${sourcesToFix.length} source(s) à corriger`);

  const toProcess = LIMIT ? sourcesToFix.slice(0, LIMIT) : sourcesToFix;
  let fixed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const source = toProcess[i];
    const progress = `[${i + 1}/${toProcess.length}]`;

    const realTitle = await fetchArticleTitle(source.url);

    if (!realTitle || realTitle === source.currentTitle) {
      if (VERBOSE) {
        console.log(
          `${progress} SKIP ${source.publisher} — ${realTitle ? "same title" : "fetch failed"}`
        );
      }
      skipped++;
      await sleep(DELAY_MS);
      continue;
    }

    if (DRY_RUN) {
      console.log(`${progress} WOULD FIX ${source.publisher}`);
      console.log(`  Old: ${source.currentTitle}`);
      console.log(`  New: ${realTitle}`);
      fixed++;
    } else {
      await db.source.update({
        where: { id: source.id },
        data: { title: realTitle },
      });
      if (VERBOSE) {
        console.log(`${progress} FIXED ${source.publisher}`);
        console.log(`  "${realTitle}"`);
      }
      fixed++;
    }

    await sleep(DELAY_MS);
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Résultat: ${fixed} corrigé(s), ${skipped} ignoré(s), ${failed} erreur(s)`);

  await db.$disconnect?.();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
