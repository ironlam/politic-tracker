interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
}

interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

/**
 * Parse pagination params from URLSearchParams.
 * Clamps page >= 1 and limit in [1, maxLimit].
 */
export function parsePagination(
  searchParams: URLSearchParams,
  options?: PaginationOptions
): PaginationResult {
  const { defaultLimit = 50, maxLimit = 100 } = options ?? {};
  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage);
  const rawLimit = parseInt(searchParams.get("limit") || String(defaultLimit), 10);
  const limit = Math.min(maxLimit, Math.max(1, Number.isNaN(rawLimit) ? defaultLimit : rawLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
