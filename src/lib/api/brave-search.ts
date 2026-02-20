/**
 * Brave Search API client for affair enrichment.
 *
 * Searches the web and returns only results from trusted French publishers.
 * Free tier: 2000 requests/month, 1 request/second.
 */

const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

/** Whitelist of trusted French press publishers (domain → display name). */
export const TRUSTED_PUBLISHERS: Record<string, string> = {
  "lemonde.fr": "Le Monde",
  "lefigaro.fr": "Le Figaro",
  "liberation.fr": "Libération",
  "francetvinfo.fr": "Franceinfo",
  "mediapart.fr": "Mediapart",
  "publicsenat.fr": "Public Sénat",
  "lcp.fr": "LCP",
  "ouest-france.fr": "Ouest-France",
  "20minutes.fr": "20 Minutes",
  "bfmtv.com": "BFM TV",
  "tf1info.fr": "TF1 Info",
  "ladepeche.fr": "La Dépêche",
  "sudouest.fr": "Sud Ouest",
  "lexpress.fr": "L'Express",
  "lobs.fr": "L'Obs",
  "lepoint.fr": "Le Point",
  "huffingtonpost.fr": "HuffPost",
  "europe1.fr": "Europe 1",
  "rtl.fr": "RTL",
  "reuters.com": "Reuters",
  "afp.com": "AFP",
  "leprogres.fr": "Le Progrès",
  "lavoixdunord.fr": "La Voix du Nord",
  "dna.fr": "DNA",
  "ledauphine.com": "Le Dauphiné",
};

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  /** Resolved display name from TRUSTED_PUBLISHERS, null if not trusted. */
  publisher: string | null;
}

/**
 * Search Brave Web Search API and return results filtered to trusted publishers only.
 *
 * @param query - The search query (e.g. "Bernard Perrut détournement condamnation")
 * @returns Array of search results from trusted publishers
 */
export async function searchBrave(query: string): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    throw new Error("BRAVE_API_KEY environment variable is not set");
  }

  const params = new URLSearchParams({
    q: query,
    country: "fr",
    search_lang: "fr",
    count: "10",
  });

  const response = await fetch(`${BRAVE_SEARCH_URL}?${params}`, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const webResults: { title: string; url: string; description: string; age?: string }[] =
    data.web?.results ?? [];

  return webResults
    .map((r) => ({
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age,
      publisher: resolvePublisher(r.url),
    }))
    .filter((r) => r.publisher !== null);
}

/**
 * Build a search query optimized for finding press articles about a judicial affair.
 */
export function buildAffairSearchQuery(politicianName: string, affairTitle: string): string {
  // Remove "[À VÉRIFIER]" prefix and clean up
  const cleanTitle = affairTitle
    .replace(/\[À VÉRIFIER\]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return `${politicianName} ${cleanTitle} affaire judiciaire`;
}

/** Resolve a URL to a trusted publisher display name, or null. */
function resolvePublisher(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    for (const [domain, name] of Object.entries(TRUSTED_PUBLISHERS)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return name;
      }
    }
    return null;
  } catch {
    return null;
  }
}
