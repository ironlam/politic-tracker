import { describe, it, expect } from "vitest";
import { scoreDiversity, DiversityCandidate, RecentPick } from "../select-politician";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCandidate(overrides: Partial<DiversityCandidate> = {}): DiversityCandidate {
  return {
    id: "cand-1",
    civility: "Mme",
    prominenceScore: 500,
    currentPartyId: "party-A",
    mandates: [{ type: "DEPUTE", departmentCode: "75" }],
    ...overrides,
  };
}

function makeRecentPick(overrides: Partial<RecentPick> = {}): RecentPick {
  return {
    partyId: "party-B",
    departmentCode: "13",
    civility: "M.",
    chamber: "SENAT",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scoreDiversity", () => {
  it("gives max score to fully diverse candidate", () => {
    // Candidate: Mme, party-A, dept 75, AN (DEPUTE)
    // History:  M., party-B, dept 13, SENAT
    // All criteria are different → party(+3) + dept(+2) + gender(+2) + chamber(+1) + prominence(0.5)
    const candidate = makeCandidate({ prominenceScore: 500 });
    const history: RecentPick[] = [
      makeRecentPick({
        partyId: "party-B",
        departmentCode: "13",
        civility: "M.",
        chamber: "SENAT",
      }),
      makeRecentPick({ partyId: "party-C", departmentCode: "69" }),
      makeRecentPick({ partyId: "party-D", departmentCode: "33" }),
    ];

    const score = scoreDiversity(candidate, history);
    // 3 + 2 + 2 + 1 + 0.5 = 8.5
    expect(score).toBeGreaterThanOrEqual(8);
    expect(score).toBeCloseTo(8.5);
  });

  it("gives low score to same party + dept + gender", () => {
    // Candidate matches history on all 4 diversity axes
    const candidate = makeCandidate({
      civility: "M.",
      currentPartyId: "party-B",
      prominenceScore: 100,
      mandates: [{ type: "SENATEUR", departmentCode: "13" }],
    });
    const history: RecentPick[] = [
      makeRecentPick({
        partyId: "party-B",
        departmentCode: "13",
        civility: "M.",
        chamber: "SENAT",
      }),
      makeRecentPick({ partyId: "party-B", departmentCode: "13" }),
      makeRecentPick({ partyId: "party-B", departmentCode: "13" }),
    ];

    const score = scoreDiversity(candidate, history);
    // Party same in last 3 → 0, Dept same in last 3 → 0,
    // Gender same as last → 0, Chamber same as last → 0
    // Only prominence: 100/1000 = 0.1
    expect(score).toBeLessThan(2);
    expect(score).toBeCloseTo(0.1);
  });

  it("handles empty history gracefully", () => {
    // No history → all bonuses should apply (length === 0 checks)
    const candidate = makeCandidate({ prominenceScore: 800 });
    const score = scoreDiversity(candidate, []);
    // 3 + 2 + 2 + 1 + 0.8 = 8.8
    expect(score).toBeGreaterThanOrEqual(8);
    expect(score).toBeCloseTo(8.8);
  });

  it("partial diversity scores proportionally", () => {
    // Same party as one of last 3 (+0), different dept (+2),
    // same gender (+0), different chamber (+1), moderate prominence
    const candidate = makeCandidate({
      civility: "M.",
      currentPartyId: "party-B",
      prominenceScore: 600,
      mandates: [{ type: "DEPUTE", departmentCode: "75" }],
    });
    const history: RecentPick[] = [
      makeRecentPick({
        partyId: "party-B",
        departmentCode: "13",
        civility: "M.",
        chamber: "SENAT",
      }),
      makeRecentPick({ partyId: "party-C", departmentCode: "69" }),
      makeRecentPick({ partyId: "party-D", departmentCode: "33" }),
    ];

    const score = scoreDiversity(candidate, history);
    // Party: party-B is in last 3 → 0
    // Dept: 75 not in [13, 69, 33] → +2
    // Gender: M. same as M. → 0
    // Chamber: AN vs SENAT → +1
    // Prominence: 0.6
    expect(score).toBeCloseTo(3.6);
    // Strictly between "all same" and "all different"
    expect(score).toBeGreaterThan(1);
    expect(score).toBeLessThan(8);
  });
});
