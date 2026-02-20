/**
 * Wikipedia FR API Service
 *
 * Provides access to French Wikipedia via the MediaWiki API.
 * Used for discovering judicial sections on politician pages.
 */

import { HTTPClient } from "./http-client";

// ============================================================================
// Constants
// ============================================================================

const WIKIPEDIA_API = "https://fr.wikipedia.org/w/api.php";

const RATE_LIMIT_MS = 200;

/**
 * Keywords used to identify judicial/legal sections in Wikipedia articles.
 * Matched against section titles after accent normalization.
 */
const JUDICIAL_SECTION_KEYWORDS = [
  "affaire",
  "judiciaire",
  "condamnation",
  "controverse",
  "démêlé",
  "poursuite",
  "mise en examen",
  "procès",
  "justice",
  "juridique",
  "pénal",
];

// ============================================================================
// Types
// ============================================================================

export interface WikipediaSection {
  index: string;
  title: string;
  level: number;
}

export interface WikipediaSectionContent {
  title: string;
  wikitext: string;
}

// ============================================================================
// MediaWiki API response types
// ============================================================================

interface MediaWikiSectionsResponse {
  parse: {
    sections: Array<{
      index: string;
      line: string;
      level: string;
    }>;
  };
}

interface MediaWikiWikitextResponse {
  parse: {
    wikitext: {
      "*": string;
    };
  };
}

// ============================================================================
// Service
// ============================================================================

export class WikipediaService {
  private client: HTTPClient;

  constructor() {
    this.client = new HTTPClient({
      rateLimitMs: RATE_LIMIT_MS,
      retries: 3,
      timeout: 30000,
      sourceName: "Wikipedia FR",
    });
  }

  // --------------------------------------------------------------------------
  // Public Methods
  // --------------------------------------------------------------------------

  /**
   * Get all sections of a Wikipedia page.
   */
  async getSections(pageTitle: string): Promise<WikipediaSection[]> {
    try {
      const url = new URL(WIKIPEDIA_API);
      url.searchParams.set("action", "parse");
      url.searchParams.set("page", pageTitle);
      url.searchParams.set("prop", "sections");
      url.searchParams.set("format", "json");

      const response = await this.client.get<MediaWikiSectionsResponse>(url.toString());

      return (response.data.parse?.sections || []).map((s) => ({
        index: s.index,
        title: s.line,
        level: parseInt(s.level, 10),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get the wikitext content of a specific section.
   */
  async getSectionContent(pageTitle: string, sectionIndex: string): Promise<string | null> {
    try {
      const url = new URL(WIKIPEDIA_API);
      url.searchParams.set("action", "parse");
      url.searchParams.set("page", pageTitle);
      url.searchParams.set("prop", "wikitext");
      url.searchParams.set("section", sectionIndex);
      url.searchParams.set("format", "json");

      const response = await this.client.get<MediaWikiWikitextResponse>(url.toString());

      return response.data.parse?.wikitext?.["*"] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Find all judicial/legal sections on a Wikipedia page.
   * Fetches section list, filters by judicial keywords, then retrieves content.
   * Skips sections with less than 50 characters of content.
   */
  async findJudicialSections(pageTitle: string): Promise<WikipediaSectionContent[]> {
    const sections = await this.getSections(pageTitle);

    const judicialSections = sections.filter((s) => this.isJudicialSection(s.title));

    const results: WikipediaSectionContent[] = [];

    for (const section of judicialSections) {
      const wikitext = await this.getSectionContent(pageTitle, section.index);

      if (wikitext && wikitext.length >= 50) {
        results.push({
          title: section.title,
          wikitext,
        });
      }
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  /**
   * Check if a section title matches any judicial keyword.
   * Both the title and keywords are normalized (lowercase + accent removal).
   */
  private isJudicialSection(title: string): boolean {
    const normalizedTitle = this.normalizeText(title);

    return JUDICIAL_SECTION_KEYWORDS.some((keyword) => {
      const normalizedKeyword = this.normalizeText(keyword);
      return normalizedTitle.includes(normalizedKeyword);
    });
  }

  /**
   * Normalize text: lowercase + NFD accent removal.
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
}

/**
 * Default Wikipedia service instance
 */
export const wikipediaService = new WikipediaService();
