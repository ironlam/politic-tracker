/**
 * One-off fix: find real article titles for PRESSE sources
 * that got the affair title instead of the article title.
 *
 * Strategy: search each URL in Brave Search API (fast, no paywall issue),
 * fallback to HTML scraping if Brave doesn't find the URL.
 *
 * Usage:
 *   npx tsx scripts/fix-source-titles.ts [--dry-run] [--limit=N] [--verbose]
 */

import { db } from "../src/lib/db";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const VERBOSE = args.includes("--verbose");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1]) : undefined;

const BRAVE_DELAY_MS = 250; // Brave free tier: 1 req/s, stay safe at 250ms
const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Search Brave for the exact URL and return its indexed title.
 */
async function fetchTitleViaBrave(url: string): Promise<string | null> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) return null;

  try {
    // Use "site:" operator to find the exact page
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const pathname = new URL(url).pathname;
    const query = `site:${hostname} ${pathname}`;

    const params = new URLSearchParams({
      q: query,
      country: "fr",
      search_lang: "fr",
      count: "5",
    });

    const response = await fetch(`${BRAVE_SEARCH_URL}?${params}`, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const results: { title: string; url: string }[] = data.web?.results ?? [];

    // Find the result matching our URL (normalize for comparison)
    const normalizeUrl = (u: string) =>
      u
        .replace(/^https?:\/\/(www\.)?/, "")
        .replace(/\/$/, "")
        .toLowerCase();
    const targetNorm = normalizeUrl(url);

    const match = results.find((r) => normalizeUrl(r.url) === targetNorm);
    if (match && match.title.length > 5) {
      return match.title.trim();
    }

    // If no exact match, use first result if it's from the same domain
    if (results.length > 0) {
      const firstHostname = new URL(results[0].url).hostname.replace(/^www\./, "");
      if (firstHostname === hostname && results[0].title.length > 5) {
        return results[0].title.trim();
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fallback: scrape og:title or <title> from the page directly.
 */
async function fetchTitleViaScraping(url: string): Promise<string | null> {
  try {
    const { JSDOM } = await import("jsdom");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Poligraph/1.0; +https://poligraph.fr)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });

    if (!response.ok) return null;

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content");
    if (ogTitle && ogTitle.trim().length > 5) return ogTitle.trim();

    const titleTag = doc.querySelector("title")?.textContent;
    if (titleTag && titleTag.trim().length > 5) {
      return titleTag
        .trim()
        .replace(
          /\s*[|–—-]\s*(Le Monde|Le Figaro|Libération|L'Obs|France Info|Mediapart|Public Sénat|Le Point|L'Express|France 24|20 Minutes|BFMTV|La Croix|Ouest-France|Sud Ouest|La Dépêche|Le Parisien|Les Échos|Challenges|L'Humanité|Courrier international|France Bleu|franceinfo).*$/i,
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
  console.log(`Strategy: Brave API → HTML scraping fallback`);
  console.log("=".repeat(50));

  if (!process.env.BRAVE_API_KEY) {
    console.warn("⚠ BRAVE_API_KEY non définie — fallback scraping uniquement");
  }

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
  // where every source has the same title (= the affair title was used)
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
  let skipped = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const source = toProcess[i];
    const progress = `[${i + 1}/${toProcess.length}]`;

    // Try Brave first, then scraping
    let realTitle = await fetchTitleViaBrave(source.url);
    let method = "Brave";

    if (!realTitle) {
      realTitle = await fetchTitleViaScraping(source.url);
      method = "scraping";
    }

    if (!realTitle || realTitle === source.currentTitle) {
      if (VERBOSE) {
        console.log(
          `${progress} SKIP ${source.publisher} — ${realTitle ? "same title" : "not found"}`
        );
      }
      skipped++;
      await sleep(BRAVE_DELAY_MS);
      continue;
    }

    if (DRY_RUN) {
      console.log(`${progress} WOULD FIX ${source.publisher} (via ${method})`);
      console.log(`  Old: ${source.currentTitle}`);
      console.log(`  New: ${realTitle}`);
      fixed++;
    } else {
      await db.source.update({
        where: { id: source.id },
        data: { title: realTitle },
      });
      console.log(`${progress} FIXED ${source.publisher} (via ${method})`);
      if (VERBOSE) {
        console.log(`  "${realTitle}"`);
      }
      fixed++;
    }

    await sleep(BRAVE_DELAY_MS);
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Résultat: ${fixed} corrigé(s), ${skipped} ignoré(s)`);

  await db.$disconnect?.();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
