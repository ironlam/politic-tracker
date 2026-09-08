import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The ISR revalidate a route actually gets is
 * MIN(`export const revalidate`, `cacheLife.revalidate` of EVERY `"use cache"`
 * boundary it consumes). The built-in `minutes` profile revalidates every 60 s,
 * so a single boundary using it drags every route that reads it back to 60 s
 * whatever the page declares.
 *
 * That is not theoretical: it is what produced 8.7M ISR writes on the July 2026
 * Vercel bill, and the remedy was replacing 106 `minutes`/`hours` boundaries
 * with the custom `synced` profile (revalidate 86400) declared in
 * `next.config.ts`. Freshness does not depend on that timer: everything is
 * invalidated on demand by `revalidateTag`, from the daily sync and from admin
 * edits. The timer is only a backstop.
 *
 * The rule the July fix wrote down is exhaustiveness, because one forgotten
 * boundary re-blocks a whole route. `getPresidentialOverviewStats` was added
 * afterwards with `cacheLife("minutes")` and re-blocked /statistiques at 60 s,
 * which is what this guard exists to catch.
 */

const SRC_DIR = join(process.cwd(), "src");

/**
 * Boundaries allowed to keep a shorter profile, with the reason each one is a
 * deliberate trade-off rather than an oversight. Both are documented in the
 * file that carries them.
 */
const SHORTER_PROFILE_ALLOWED = new Map([
  ["lib/data/pipelines.ts", "admin pipeline dashboard: staleness is the thing being diagnosed"],
  ["lib/data/elections.ts", "flips on the clock on polling day, and no tag purge happens that day"],
]);

/** Every source file, tests and generated Prisma client aside. */
function sourceFiles(dir = SRC_DIR): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "generated" || entry.name === "__tests__") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Drop block and line comments so the predicates below read code, not prose. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function cacheLifeProfiles(file: string): string[] {
  const src = stripComments(readFileSync(file, "utf8"));
  return [...src.matchAll(/cacheLife\("([a-z]+)"\)/g)].map((m) => m[1]!);
}

describe("profils cacheLife et revalidate ISR effectif", () => {
  it("trouve bien des frontières cacheLife à inspecter", () => {
    // Guards the walk itself: finding nothing would make the assertion below
    // vacuously true.
    const total = sourceFiles().reduce((n, f) => n + cacheLifeProfiles(f).length, 0);
    expect(total).toBeGreaterThan(100);
  });

  it("toute frontière utilise le profil synced, hors exceptions documentées", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const rel = relative(SRC_DIR, file);
      if (SHORTER_PROFILE_ALLOWED.has(rel)) continue;
      for (const profile of cacheLifeProfiles(file)) {
        if (profile !== "synced") offenders.push(`${rel}: cacheLife("${profile}")`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("les exceptions autorisées existent encore et portent bien un profil court", () => {
    // An allowlist entry that no longer matches reality is a stale exemption:
    // it would silently permit a future `minutes` boundary in that file.
    for (const [rel] of SHORTER_PROFILE_ALLOWED) {
      const profiles = cacheLifeProfiles(join(SRC_DIR, rel));
      expect(profiles.length, `${rel} ne déclare plus de cacheLife`).toBeGreaterThan(0);
      expect(
        profiles.some((p) => p !== "synced"),
        `${rel} est passé à synced`
      ).toBe(true);
    }
  });

  it("ne se laisse pas berner par une mention en commentaire", () => {
    const commentOnly = `
      // cacheLife("minutes") is only named here.
      /* cacheLife("hours") */
      cacheLife("synced");
    `;
    expect(
      [...stripComments(commentOnly).matchAll(/cacheLife\("([a-z]+)"\)/g)].map((m) => m[1])
    ).toEqual(["synced"]);
  });
});
