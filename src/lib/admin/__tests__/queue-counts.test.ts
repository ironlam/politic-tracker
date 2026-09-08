import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  db: {
    $queryRaw: vi.fn(),
    pressAnalysisRejection: { count: vi.fn() },
    syncJob: { count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db: h.db }));

import {
  countArticlesToLink,
  countRecentPressRejections,
  countRecentFailedSyncs,
  FAILURE_WINDOW_DAYS,
} from "../queue-counts";

describe("countArticlesToLink", () => {
  beforeEach(() => h.db.$queryRaw.mockReset());

  it("exclut les articles que le registre a déjà résolus négativement", async () => {
    h.db.$queryRaw.mockResolvedValue([{ count: BigInt(1318) }]);

    await countArticlesToLink();

    // Le template SQL est passé en fragments : on vérifie l'intention.
    const sql = h.db.$queryRaw.mock.calls[0]![0].join(" ");
    expect(sql).toContain("NO_MATCH");
    expect(sql).toContain("NOT_SAME");
    expect(sql).toContain("PressArticleAffair");
  });

  it("convertit le bigint de COUNT en nombre", async () => {
    h.db.$queryRaw.mockResolvedValue([{ count: BigInt(1318) }]);
    await expect(countArticlesToLink()).resolves.toBe(1318);
  });

  it("renvoie 0 quand la requête ne ramène aucune ligne", async () => {
    h.db.$queryRaw.mockResolvedValue([]);
    await expect(countArticlesToLink()).resolves.toBe(0);
  });
});

describe("fenêtre temporelle des échecs", () => {
  beforeEach(() => {
    h.db.pressAnalysisRejection.count.mockReset().mockResolvedValue(0);
    h.db.syncJob.count.mockReset().mockResolvedValue(0);
  });

  const windowStart = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[0]![0].where;

  it("borne les rejets presse à la fenêtre", async () => {
    await countRecentPressRejections();

    const gte = windowStart(h.db.pressAnalysisRejection.count).rejectedAt.gte as Date;
    const ageDays = (Date.now() - gte.getTime()) / 86_400_000;
    expect(ageDays).toBeCloseTo(FAILURE_WINDOW_DAYS, 1);
  });

  it("borne les syncs en échec à la fenêtre, sinon février compte en septembre", async () => {
    await countRecentFailedSyncs();

    const where = windowStart(h.db.syncJob.count);
    expect(where.status).toBe("FAILED");
    const ageDays = (Date.now() - (where.createdAt.gte as Date).getTime()) / 86_400_000;
    expect(ageDays).toBeCloseTo(FAILURE_WINDOW_DAYS, 1);
  });
});
