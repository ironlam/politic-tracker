# Health — Audit Vercel Deployment & Site Performance

Check Vercel deployment logs, detect DB connection issues, and audit overall site health.

## Instructions

When the user invokes `/health`, perform a full health check of the production site.

### Arguments

- `/health` — full audit (deployment + errors + performance)
- `/health deploy` — check latest Vercel deployment status only
- `/health errors` — scan recent function logs for errors
- `/health perf` — audit codebase for performance anti-patterns
- `/health db` — focus on database connection health

### Steps

#### 1. Check Vercel deployment status

```bash
# Latest deployments
npx vercel ls --limit 5

# Latest deployment details (production)
npx vercel inspect $(npx vercel ls --limit 1 2>/dev/null | grep Production | awk '{print $2}') 2>/dev/null
```

If `vercel` CLI is not authenticated, fall back to GitHub Actions:
```bash
gh run list --workflow=deploy --limit 5
```

#### 2. Scan function logs for errors

```bash
# Stream recent production logs (60 seconds window)
npx vercel logs --limit 100 2>/dev/null
```

**Error patterns to search for (by severity):**

| Pattern | Severity | Meaning |
|---------|----------|---------|
| `Max client connections reached` | CRITICAL | Pool exhaustion — too many concurrent DB queries |
| `DriverAdapterError` | CRITICAL | Prisma connection failure |
| `connectionTimeoutMillis` | HIGH | Pool queue full, queries waiting >10s |
| `ECONNREFUSED` | HIGH | Database unreachable |
| `PrismaClientKnownRequestError` | MEDIUM | Query error (constraint violation, not found) |
| `504 Gateway Timeout` | MEDIUM | Function exceeded maxDuration |
| `FUNCTION_INVOCATION_TIMEOUT` | MEDIUM | Vercel killed the function |
| `Error: 429` | LOW | Rate limited (Wikidata, Google API) |

If `vercel logs` is not available, check the build output:
```bash
npx vercel inspect --logs $(npx vercel ls --limit 1 2>/dev/null | grep Production | awk '{print $2}') 2>/dev/null
```

#### 3. Audit database connection health

Check the pool configuration:
```bash
# Read current pool config
cat src/lib/db.ts
```

**Checklist:**
- [ ] Pool `max` is 5-10 (not 1-3 for production)
- [ ] `connectionTimeoutMillis` is 5000-10000 (fail fast)
- [ ] `idleTimeoutMillis` is 10000-15000 (release fast in serverless)
- [ ] `allowExitOnIdle: true` is set (serverless cleanup)
- [ ] DATABASE_URL uses PgBouncer (port 6543, `?pgbouncer=true`)

Check for connection pressure:
```bash
# Count parallel queries per page (Promise.all with db calls)
grep -rn "Promise.all" src/app/ --include="*.tsx" --include="*.ts" | head -20

# Count pages without caching
grep -rL "use cache\|revalidate" src/app/**/page.tsx 2>/dev/null | head -20
```

#### 4. Audit caching coverage

**Every page.tsx should have at least one of:**
- `export const revalidate = N` (ISR at CDN level)
- `"use cache"` on data functions (function-level cache)

Scan for uncached pages:

```bash
# Pages with neither revalidate nor "use cache"
for f in $(find src/app -name "page.tsx" -not -path "*/\[*"); do
  if ! grep -q 'revalidate\|"use cache"' "$f" 2>/dev/null; then
    echo "UNCACHED: $f"
  fi
done
```

**Scan for unbounded `"use cache"` (search params = cache explosion):**
```bash
grep -B5 '"use cache"' src/app/**/page.tsx | grep -i "search\|query\|q=" | head -10
```

#### 5. Audit prefetch storms

Links in grids/lists without `prefetch={false}` trigger automatic SSR of target pages.

```bash
# Find Link components in list/grid components that may need prefetch={false}
grep -rn "<Link" src/components/ src/app/ --include="*.tsx" | grep -v "prefetch={false}" | grep -v "Header\|Footer\|Nav" | head -20
```

**High-risk patterns (Link in a .map() or grid without prefetch={false}):**
```bash
grep -B3 "<Link" src/components/**/*.tsx src/app/**/page.tsx 2>/dev/null | grep -A3 "\.map\|grid\|flex-wrap" | grep "<Link" | grep -v "prefetch={false}" | head -10
```

#### 6. Count max concurrent connections per page

For each major page, count how many DB queries run in parallel:

| Page | Target | Red flag |
|------|--------|----------|
| `/` (homepage) | 0 (all cached) | Any uncached query |
| `/politiques` | 1 (single SQL) | Multiple count queries |
| `/affaires` | <=3 | >5 parallel queries |
| `/factchecks` | <=3 | >5 parallel queries |
| `/statistiques` | <=5 (cached) | >10 on cold cache |
| `/partis/[slug]` | <=2 (cached+dedup) | Double query for metadata |
| `/api/chat` | <=3 | Queries during streaming |

#### 7. Generate report

Present findings as:

```
## Site Health Report — [date]

### Deployment
- Status: OK/ERROR
- Last deploy: [timestamp]
- Build time: [duration]

### Errors (last 24h)
- Critical: [count] (connection exhaustion, adapter errors)
- High: [count] (timeouts, connection refused)
- Medium: [count] (query errors, function timeouts)

### Database Connections
- Pool config: max=[N], idle=[N]ms, timeout=[N]ms
- PgBouncer: YES/NO
- Max concurrent queries (worst page): [N]

### Caching
- Pages with ISR/cache: [N]/[total]
- Uncached pages: [list]
- Prefetch storms: [list of components]

### Recommendations
1. [Priority fix]
2. [Priority fix]
...
```

### Known issues & recurring problems

**"Max client connections reached"** — Usually caused by:
1. New `<Link>` added without `prefetch={false}` in a grid/list
2. New page without `"use cache"` or `revalidate`
3. `Promise.all` with too many parallel queries (>5)
4. Cache cold start after deploy (all pages revalidate simultaneously)

**Prevention rules:**
- ALWAYS add `prefetch={false}` to Links in lists/grids (cards, search results, filters)
- ALWAYS add caching to page data functions
- NEVER put `"use cache"` on a function with a free-text `search` param
- Prefer `export const revalidate = 300` for listing pages with search
- Consolidate count queries into single SQL `COUNT(*) FILTER` when >3
