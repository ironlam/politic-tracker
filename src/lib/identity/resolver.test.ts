import { describe, it, expect, vi, beforeEach } from "vitest";
import { DataSource, Judgement, MatchMethod } from "@/generated/prisma";

// Mock the db module before importing resolver
vi.mock("@/lib/db", () => ({
  db: {
    politician: {
      findMany: vi.fn(),
    },
    externalId: {
      findFirst: vi.fn(),
    },
    identityDecision: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { resolve } from "./resolver";
import { db } from "@/lib/db";

const mockedDb = vi.mocked(db);

describe("IdentityResolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no prior decisions
    mockedDb.identityDecision.findMany.mockResolvedValue([]);
    // Default: no ExternalId match
    mockedDb.externalId.findFirst.mockResolvedValue(null);
    // Default: no name candidates
    mockedDb.politician.findMany.mockResolvedValue([]);
    // Default: log decision succeeds
    mockedDb.identityDecision.create.mockResolvedValue({} as never);
  });

  describe("Step 1: Check prior decisions", () => {
    it("returns NOT_SAME when all candidates are blocked", async () => {
      mockedDb.identityDecision.findMany.mockResolvedValue([
        {
          id: "dec-1",
          sourceType: DataSource.RNE,
          sourceId: "70069",
          politicianId: "pol-1",
          judgement: Judgement.NOT_SAME,
          confidence: 1.0,
          method: MatchMethod.MANUAL,
          evidence: {},
          decidedBy: "admin:ldiaby",
          decidedAt: new Date(),
          supersededBy: null,
        },
      ]);
      mockedDb.politician.findMany.mockResolvedValue([
        {
          id: "pol-1",
          firstName: "Thierry",
          lastName: "Cousin",
          birthDate: new Date("1960-05-16"),
          mandates: [],
        },
      ]);

      const result = await resolve({
        firstName: "Thierry",
        lastName: "Cousin",
        source: DataSource.RNE,
        sourceId: "70069",
      });

      expect(result.blocked).toBe(true);
      expect(result.politicianId).toBeNull();
    });

    it("returns SAME immediately when a high-confidence SAME decision exists", async () => {
      mockedDb.identityDecision.findMany.mockResolvedValue([
        {
          id: "dec-1",
          sourceType: DataSource.RNE,
          sourceId: "70069",
          politicianId: "pol-1",
          judgement: Judgement.SAME,
          confidence: 0.98,
          method: MatchMethod.MANUAL,
          evidence: {},
          decidedBy: "admin:ldiaby",
          decidedAt: new Date(),
          supersededBy: null,
        },
      ]);

      const result = await resolve({
        firstName: "Thierry",
        lastName: "Cousin",
        source: DataSource.RNE,
        sourceId: "70069",
      });

      expect(result.politicianId).toBe("pol-1");
      expect(result.decision).toBe(Judgement.SAME);
      expect(result.confidence).toBe(0.98);
    });

    it("does not short-circuit on low-confidence SAME decision", async () => {
      mockedDb.identityDecision.findMany.mockResolvedValue([
        {
          id: "dec-1",
          sourceType: DataSource.RNE,
          sourceId: "70069",
          politicianId: "pol-1",
          judgement: Judgement.SAME,
          confidence: 0.7, // Below AUTO_MATCH threshold
          method: MatchMethod.NAME_ONLY,
          evidence: {},
          decidedBy: "system:sync-rne",
          decidedAt: new Date(),
          supersededBy: null,
        },
      ]);
      // Should still proceed to candidate matching
      mockedDb.politician.findMany.mockResolvedValue([]);

      const result = await resolve({
        firstName: "Jean",
        lastName: "Martin",
        source: DataSource.RNE,
        sourceId: "70069",
      });

      // Should not have used the prior decision as auto-match
      expect(result.decision).toBe("NEW");
    });
  });

  describe("Step 2: Deterministic match via ExternalId", () => {
    it("matches by shared ExternalId with confidence 1.0", async () => {
      mockedDb.externalId.findFirst.mockResolvedValue({
        politicianId: "pol-1",
      } as never);

      const result = await resolve({
        firstName: "Jean",
        lastName: "Dupont",
        source: DataSource.ASSEMBLEE_NATIONALE,
        sourceId: "PA789456",
      });

      expect(result.politicianId).toBe("pol-1");
      expect(result.confidence).toBe(1.0);
      expect(result.method).toBe(MatchMethod.EXTERNAL_ID);
      expect(result.decision).toBe(Judgement.SAME);
    });

    it("does not match ExternalId that is blocked by NOT_SAME decision", async () => {
      mockedDb.identityDecision.findMany.mockResolvedValue([
        {
          id: "dec-1",
          sourceType: DataSource.ASSEMBLEE_NATIONALE,
          sourceId: "PA789456",
          politicianId: "pol-1",
          judgement: Judgement.NOT_SAME,
          confidence: 1.0,
          method: MatchMethod.MANUAL,
          evidence: {},
          decidedBy: "admin:ldiaby",
          decidedAt: new Date(),
          supersededBy: null,
        },
      ]);
      mockedDb.externalId.findFirst.mockResolvedValue({
        politicianId: "pol-1",
      } as never);
      mockedDb.politician.findMany.mockResolvedValue([]);

      const result = await resolve({
        firstName: "Jean",
        lastName: "Dupont",
        source: DataSource.ASSEMBLEE_NATIONALE,
        sourceId: "PA789456",
      });

      // Should NOT match pol-1 because it's blocked
      expect(result.politicianId).not.toBe("pol-1");
    });
  });

  describe("Step 3: Birthdate match", () => {
    it("matches single candidate with matching birthdate at 0.9 confidence", async () => {
      mockedDb.politician.findMany.mockResolvedValue([
        {
          id: "pol-1",
          firstName: "Thierry",
          lastName: "Cousin",
          birthDate: new Date("1960-05-16"),
          mandates: [{ departmentCode: "45" }],
        },
      ]);

      const result = await resolve({
        firstName: "Thierry",
        lastName: "Cousin",
        birthDate: new Date("1960-05-16"),
        source: DataSource.RNE,
        sourceId: "45321",
      });

      expect(result.politicianId).toBe("pol-1");
      expect(result.confidence).toBe(0.9);
      expect(result.method).toBe(MatchMethod.BIRTHDATE);
    });

    it("rejects single candidate with mismatched birthdate", async () => {
      mockedDb.politician.findMany.mockResolvedValue([
        {
          id: "pol-1",
          firstName: "Thierry",
          lastName: "Cousin",
          birthDate: new Date("1960-05-16"),
          mandates: [],
        },
      ]);

      const result = await resolve({
        firstName: "Thierry",
        lastName: "Cousin",
        birthDate: new Date("1975-03-22"),
        source: DataSource.RNE,
        sourceId: "70069",
      });

      expect(result.politicianId).toBeNull();
      expect(result.decision).toBe("NEW");
    });

    it("disambiguates homonyms by birthdate", async () => {
      mockedDb.politician.findMany.mockResolvedValue([
        {
          id: "pol-1",
          firstName: "Thierry",
          lastName: "Cousin",
          birthDate: new Date("1960-05-16"),
          mandates: [{ departmentCode: "45" }],
        },
        {
          id: "pol-2",
          firstName: "Thierry",
          lastName: "Cousin",
          birthDate: new Date("1975-03-22"),
          mandates: [{ departmentCode: "70" }],
        },
      ]);

      const result = await resolve({
        firstName: "Thierry",
        lastName: "Cousin",
        birthDate: new Date("1975-03-22"),
        source: DataSource.RNE,
        sourceId: "70069",
      });

      expect(result.politicianId).toBe("pol-2");
      expect(result.method).toBe(MatchMethod.BIRTHDATE);
    });
  });

  describe("Step 4: Department match", () => {
    it("matches candidate with matching department mandate at 0.7 confidence", async () => {
      mockedDb.politician.findMany.mockResolvedValue([
        {
          id: "pol-1",
          firstName: "Jean",
          lastName: "Martin",
          birthDate: null,
          mandates: [{ departmentCode: "75" }],
        },
      ]);

      const result = await resolve({
        firstName: "Jean",
        lastName: "Martin",
        department: "75",
        source: DataSource.RNE,
        sourceId: "75056",
      });

      expect(result.politicianId).toBe("pol-1");
      expect(result.method).toBe(MatchMethod.DEPARTMENT);
      expect(result.confidence).toBe(0.7);
    });

    it("does not override birthdate match with department match", async () => {
      mockedDb.politician.findMany.mockResolvedValue([
        {
          id: "pol-1",
          firstName: "Jean",
          lastName: "Martin",
          birthDate: new Date("1970-01-01"),
          mandates: [{ departmentCode: "75" }],
        },
      ]);

      const result = await resolve({
        firstName: "Jean",
        lastName: "Martin",
        birthDate: new Date("1970-01-01"),
        department: "75",
        source: DataSource.RNE,
        sourceId: "75056",
      });

      // Birthdate match (0.9) should take priority over department (0.7)
      expect(result.confidence).toBe(0.9);
      expect(result.method).toBe(MatchMethod.BIRTHDATE);
    });
  });

  describe("Step 6: Threshold decisions", () => {
    it("returns UNDECIDED for candidate in review zone (0.70-0.94)", async () => {
      mockedDb.politician.findMany.mockResolvedValue([
        {
          id: "pol-1",
          firstName: "Jean",
          lastName: "Martin",
          birthDate: null,
          mandates: [{ departmentCode: "75" }],
        },
      ]);

      const result = await resolve({
        firstName: "Jean",
        lastName: "Martin",
        department: "75",
        source: DataSource.RNE,
        sourceId: "75056",
      });

      // Department match gives 0.7 — in the review zone
      expect(result.decision).toBe(Judgement.UNDECIDED);
      expect(result.politicianId).toBe("pol-1");
    });

    it("returns NEW for candidate below REVIEW threshold", async () => {
      mockedDb.politician.findMany.mockResolvedValue([
        {
          id: "pol-1",
          firstName: "Jean",
          lastName: "Martin",
          birthDate: null,
          mandates: [],
        },
      ]);

      const result = await resolve({
        firstName: "Jean",
        lastName: "Martin",
        source: DataSource.RNE,
        sourceId: "99001",
      });

      // Name-only match: 0.5 confidence → below REVIEW threshold (0.70)
      expect(result.politicianId).toBeNull();
      expect(result.decision).toBe("NEW");
    });

    it("returns NEW when no candidates found", async () => {
      mockedDb.politician.findMany.mockResolvedValue([]);

      const result = await resolve({
        firstName: "Inconnu",
        lastName: "Personne",
        source: DataSource.RNE,
        sourceId: "00000",
      });

      expect(result.politicianId).toBeNull();
      expect(result.decision).toBe("NEW");
      expect(result.candidates).toEqual([]);
    });

    it("auto-matches at 0.9 birthdate with confidence >= REVIEW (UNDECIDED)", async () => {
      mockedDb.politician.findMany.mockResolvedValue([
        {
          id: "pol-1",
          firstName: "Marie",
          lastName: "Durand",
          birthDate: new Date("1970-01-01"),
          mandates: [],
        },
      ]);

      const result = await resolve({
        firstName: "Marie",
        lastName: "Durand",
        birthDate: new Date("1970-01-01"),
        source: DataSource.RNE,
        sourceId: "12345",
      });

      // 0.9 is in review zone (0.70-0.94)
      expect(result.politicianId).toBe("pol-1");
      expect(result.decision).toBe(Judgement.UNDECIDED);
      expect(result.confidence).toBe(0.9);
    });
  });

  describe("Step 7: Logging", () => {
    it("creates an IdentityDecision after resolving a match", async () => {
      mockedDb.politician.findMany.mockResolvedValue([
        {
          id: "pol-1",
          firstName: "Marie",
          lastName: "Durand",
          birthDate: new Date("1970-01-01"),
          mandates: [],
        },
      ]);

      await resolve({
        firstName: "Marie",
        lastName: "Durand",
        birthDate: new Date("1970-01-01"),
        source: DataSource.RNE,
        sourceId: "12345",
      });

      expect(mockedDb.identityDecision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sourceType: DataSource.RNE,
          sourceId: "12345",
          politicianId: "pol-1",
          judgement: Judgement.UNDECIDED,
          method: MatchMethod.BIRTHDATE,
        }),
      });
    });

    it("does not log for NEW decisions with no candidates", async () => {
      mockedDb.politician.findMany.mockResolvedValue([]);

      await resolve({
        firstName: "Inconnu",
        lastName: "Personne",
        source: DataSource.RNE,
        sourceId: "00000",
      });

      expect(mockedDb.identityDecision.create).not.toHaveBeenCalled();
    });

    it("does not break the resolver if logging fails", async () => {
      mockedDb.politician.findMany.mockResolvedValue([
        {
          id: "pol-1",
          firstName: "Marie",
          lastName: "Durand",
          birthDate: new Date("1970-01-01"),
          mandates: [],
        },
      ]);
      mockedDb.identityDecision.create.mockRejectedValue(new Error("DB connection lost"));

      // Should not throw
      const result = await resolve({
        firstName: "Marie",
        lastName: "Durand",
        birthDate: new Date("1970-01-01"),
        source: DataSource.RNE,
        sourceId: "12345",
      });

      expect(result.politicianId).toBe("pol-1");
    });
  });
});
