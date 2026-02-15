/**
 * Judilibre API Client (Cour de cassation via PISTE)
 *
 * OAuth 2.0 client credentials flow for searching criminal decisions.
 * Uses HTTPClient for API calls with retry and rate limiting.
 */

import { HTTPClient, HTTPError } from "./http-client";
import { JUDILIBRE_RATE_LIMIT_MS } from "@/config/rate-limits";

// ============================================
// TYPES
// ============================================

export interface JudilibreSearchResult {
  results: JudilibreDecisionSummary[];
  total: number;
  page: number;
  page_size: number;
  next_page?: string;
  previous_page?: string;
}

export interface JudilibreDecisionSummary {
  id: string;
  ecli: string;
  number: string; // N° pourvoi principal
  numbers: string[]; // Tous les n° pourvoi
  decision_date: string; // YYYY-MM-DD
  chamber: string;
  solution: string; // "rejet", "cassation", "irrecevabilité"...
  themes: string[];
  summary: string;
}

export interface JudilibreDecision extends JudilibreDecisionSummary {
  text: string; // Texte intégral
  zones: Record<string, { start: number; end: number }[]>;
}

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface JudilibreSearchFilters {
  chamber?: string; // "cr" for criminelle
  date_start?: string; // YYYY-MM-DD
  date_end?: string;
  solution?: string;
  page?: number;
  page_size?: number;
}

// ============================================
// CLIENT
// ============================================

/** Token refresh buffer — renew 60s before expiry */
const TOKEN_BUFFER_MS = 60_000;

export class JudilibreClient {
  private httpClient: HTTPClient;
  private oauthUrl: string;
  private clientId: string;
  private clientSecret: string;

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor() {
    const baseUrl = process.env.JUDILIBRE_BASE_URL;
    const oauthUrl = process.env.JUDILIBRE_OAUTH_URL;
    const clientId = process.env.JUDILIBRE_CLIENT_ID;
    const clientSecret = process.env.JUDILIBRE_CLIENT_SECRET;

    if (!baseUrl || !oauthUrl || !clientId || !clientSecret) {
      throw new Error(
        "Missing Judilibre config. Set JUDILIBRE_BASE_URL, JUDILIBRE_OAUTH_URL, JUDILIBRE_CLIENT_ID, JUDILIBRE_CLIENT_SECRET"
      );
    }

    this.oauthUrl = oauthUrl;
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    this.httpClient = new HTTPClient({
      baseUrl,
      rateLimitMs: JUDILIBRE_RATE_LIMIT_MS,
      retries: 2,
      retryDelay: 2000,
      timeout: 30_000,
    });
  }

  /**
   * Authenticate via OAuth 2.0 client credentials.
   * Auto-refreshes when token is about to expire.
   */
  private async ensureAuthenticated(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - TOKEN_BUFFER_MS) {
      return;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "openid",
    });

    const response = await fetch(this.oauthUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Judilibre OAuth failed (${response.status}): ${text}`);
    }

    const data: OAuthTokenResponse = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
  }

  /**
   * Get authorization headers for API requests
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    await this.ensureAuthenticated();
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  /**
   * Search criminal decisions by query string
   */
  async searchDecisions(
    query: string,
    filters: JudilibreSearchFilters = {}
  ): Promise<JudilibreSearchResult> {
    const headers = await this.getAuthHeaders();

    const params = new URLSearchParams({ query });
    if (filters.chamber) params.set("chamber", filters.chamber);
    if (filters.date_start) params.set("date_start", filters.date_start);
    if (filters.date_end) params.set("date_end", filters.date_end);
    if (filters.solution) params.set("solution", filters.solution);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.page_size) params.set("page_size", String(filters.page_size));

    try {
      const response = await this.httpClient.get<JudilibreSearchResult>(
        `/search?${params.toString()}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      if (error instanceof HTTPError && error.status === 404) {
        // No results
        return { results: [], total: 0, page: 0, page_size: 10 };
      }
      throw error;
    }
  }

  /**
   * Get full decision text by ID
   */
  async getDecision(id: string): Promise<JudilibreDecision> {
    const headers = await this.getAuthHeaders();
    const response = await this.httpClient.get<JudilibreDecision>(`/decision?id=${id}`, {
      headers,
    });
    return response.data;
  }

  /**
   * Health check
   */
  async healthcheck(): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders();
      await this.httpClient.get("/healthcheck", { headers });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a new Judilibre client instance.
 * Returns null if env vars are not configured.
 */
export function createJudilibreClient(): JudilibreClient | null {
  if (!process.env.JUDILIBRE_CLIENT_ID || !process.env.JUDILIBRE_CLIENT_SECRET) {
    return null;
  }
  return new JudilibreClient();
}
