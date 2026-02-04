/**
 * HTTP Client with retry, backoff, and rate limiting
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Rate limiting between requests
 * - Timeout handling
 * - Batch requests with concurrency control
 */

export interface HTTPClientOptions {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  rateLimitMs?: number;
  userAgent?: string;
  headers?: Record<string, string>;
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export interface HTTPResponse<T> {
  data: T;
  status: number;
  ok: boolean;
}

export class HTTPError extends Error {
  constructor(
    message: string,
    public status: number,
    public url: string
  ) {
    super(message);
    this.name = "HTTPError";
  }
}

const DEFAULT_OPTIONS: Required<HTTPClientOptions> = {
  baseUrl: "",
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  rateLimitMs: 0,
  userAgent: "TransparencePolitique/1.0 (https://politic-tracker.vercel.app)",
  headers: {},
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * HTTP Client class with built-in resilience
 */
export class HTTPClient {
  private options: Required<HTTPClientOptions>;
  private lastRequestTime = 0;

  constructor(options: HTTPClientOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Wait for rate limit if needed
   */
  private async waitForRateLimit(): Promise<void> {
    if (this.options.rateLimitMs <= 0) return;

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.options.rateLimitMs) {
      await sleep(this.options.rateLimitMs - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Execute a fetch with retry logic
   */
  private async fetchWithRetry<T>(
    url: string,
    init: RequestInit,
    options: RequestOptions
  ): Promise<HTTPResponse<T>> {
    const maxRetries = options.retries ?? this.options.retries;
    const timeout = options.timeout ?? this.options.timeout;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.waitForRateLimit();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
          headers: {
            "User-Agent": this.options.userAgent,
            ...this.options.headers,
            ...init.headers,
            ...options.headers,
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Don't retry on client errors (4xx) except 429 (rate limit)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new HTTPError(
              `HTTP ${response.status}: ${response.statusText}`,
              response.status,
              url
            );
          }

          // Retry on server errors (5xx) and rate limits (429)
          if (attempt < maxRetries) {
            const delay = this.options.retryDelay * Math.pow(2, attempt);
            await sleep(delay);
            continue;
          }

          throw new HTTPError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            url
          );
        }

        const data = (await response.json()) as T;
        return { data, status: response.status, ok: true };
      } catch (error) {
        lastError = error as Error;

        // Don't retry on HTTP client errors
        if (error instanceof HTTPError && error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Retry on network errors and timeouts
        if (attempt < maxRetries) {
          const delay = this.options.retryDelay * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }
      }
    }

    throw lastError ?? new Error(`Failed to fetch ${url}`);
  }

  /**
   * GET request
   */
  async get<T>(url: string, options: RequestOptions = {}): Promise<HTTPResponse<T>> {
    const fullUrl = this.options.baseUrl ? `${this.options.baseUrl}${url}` : url;
    return this.fetchWithRetry<T>(fullUrl, { method: "GET" }, options);
  }

  /**
   * POST request
   */
  async post<T>(
    url: string,
    body: unknown,
    options: RequestOptions = {}
  ): Promise<HTTPResponse<T>> {
    const fullUrl = this.options.baseUrl ? `${this.options.baseUrl}${url}` : url;
    return this.fetchWithRetry<T>(
      fullUrl,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      },
      options
    );
  }

  /**
   * Batch GET requests with concurrency control
   */
  async batchGet<T>(
    urls: string[],
    options: RequestOptions & { concurrency?: number } = {}
  ): Promise<Array<HTTPResponse<T> | Error>> {
    const { concurrency = 5, ...requestOptions } = options;
    const results: Array<HTTPResponse<T> | Error> = [];

    // Process in chunks
    for (let i = 0; i < urls.length; i += concurrency) {
      const chunk = urls.slice(i, i + concurrency);
      const chunkResults = await Promise.allSettled(
        chunk.map((url) => this.get<T>(url, requestOptions))
      );

      for (const result of chunkResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push(result.reason as Error);
        }
      }
    }

    return results;
  }
}

/**
 * Default HTTP client instance
 */
export const httpClient = new HTTPClient();
