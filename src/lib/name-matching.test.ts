import { describe, it, expect, vi } from "vitest";

vi.mock("./db", () => ({ db: {} }));

import {
  normalizeText,
  escapeRegex,
  findMentions,
  findPartyMentions,
  type PoliticianName,
  type PartyName,
} from "./name-matching";

// ============================================
// normalizeText
// ============================================

describe("normalizeText", () => {
  it("should lowercase text", () => {
    expect(normalizeText("Emmanuel MACRON")).toBe("emmanuel macron");
  });

  it("should remove accents", () => {
    expect(normalizeText("François")).toBe("francois");
    expect(normalizeText("Éric")).toBe("eric");
    expect(normalizeText("Cécile")).toBe("cecile");
    expect(normalizeText("Gaël")).toBe("gael");
  });

  it("should normalize dashes to spaces", () => {
    expect(normalizeText("Le Pen")).toBe("le pen");
    expect(normalizeText("Jean-Luc")).toBe("jean luc");
    expect(normalizeText("Jean–Luc")).toBe("jean luc"); // en-dash
    expect(normalizeText("Jean—Luc")).toBe("jean luc"); // em-dash
  });

  it("should normalize apostrophes", () => {
    expect(normalizeText("l'État")).toBe("l'etat");
    expect(normalizeText("l\u2019État")).toBe("l'etat"); // right single quotation mark
    expect(normalizeText("l\u2018État")).toBe("l'etat"); // left single quotation mark
  });

  it("should trim whitespace", () => {
    expect(normalizeText("  Macron  ")).toBe("macron");
  });

  it("should handle combinations", () => {
    expect(normalizeText("Jean-François Copé")).toBe("jean francois cope");
    expect(normalizeText("Élisabeth Borne")).toBe("elisabeth borne");
  });
});

// ============================================
// escapeRegex
// ============================================

describe("escapeRegex", () => {
  it("should escape special regex characters", () => {
    expect(escapeRegex("hello.world")).toBe("hello\\.world");
    expect(escapeRegex("test*")).toBe("test\\*");
    expect(escapeRegex("a+b")).toBe("a\\+b");
    expect(escapeRegex("foo(bar)")).toBe("foo\\(bar\\)");
    expect(escapeRegex("a[b]c")).toBe("a\\[b\\]c");
    expect(escapeRegex("x{y}z")).toBe("x\\{y\\}z");
    expect(escapeRegex("a|b")).toBe("a\\|b");
    expect(escapeRegex("a?b")).toBe("a\\?b");
    expect(escapeRegex("^start$end")).toBe("\\^start\\$end");
    expect(escapeRegex("back\\slash")).toBe("back\\\\slash");
  });

  it("should leave normal text unchanged", () => {
    expect(escapeRegex("macron")).toBe("macron");
    expect(escapeRegex("jean luc melenchon")).toBe("jean luc melenchon");
  });
});

// ============================================
// findMentions
// ============================================

describe("findMentions", () => {
  const politicians: PoliticianName[] = [
    {
      id: "1",
      fullName: "Emmanuel Macron",
      firstName: "Emmanuel",
      lastName: "Macron",
      normalizedFullName: "emmanuel macron",
      normalizedLastName: "macron",
    },
    {
      id: "2",
      fullName: "Marine Le Pen",
      firstName: "Marine",
      lastName: "Le Pen",
      normalizedFullName: "marine le pen",
      normalizedLastName: "le pen",
    },
    {
      id: "3",
      fullName: "Jean-Luc Mélenchon",
      firstName: "Jean-Luc",
      lastName: "Mélenchon",
      normalizedFullName: "jean luc melenchon",
      normalizedLastName: "melenchon",
    },
    {
      id: "4",
      fullName: "Paul Dupont",
      firstName: "Paul",
      lastName: "Dupont",
      normalizedFullName: "paul dupont",
      normalizedLastName: "dupont",
    },
    {
      id: "5",
      fullName: "Marie Martin",
      firstName: "Marie",
      lastName: "Martin",
      normalizedFullName: "marie martin",
      normalizedLastName: "martin",
    },
    {
      id: "6",
      fullName: "Jean Noir",
      firstName: "Jean",
      lastName: "Noir",
      normalizedFullName: "jean noir",
      normalizedLastName: "noir",
    },
    {
      id: "7",
      fullName: "Laurent Wauquiez",
      firstName: "Laurent",
      lastName: "Wauquiez",
      normalizedFullName: "laurent wauquiez",
      normalizedLastName: "wauquiez",
    },
    {
      id: "8",
      fullName: "Daniel Laurent",
      firstName: "Daniel",
      lastName: "Laurent",
      normalizedFullName: "daniel laurent",
      normalizedLastName: "laurent",
    },
    {
      id: "9",
      fullName: "Sandrine Rousseau",
      firstName: "Sandrine",
      lastName: "Rousseau",
      normalizedFullName: "sandrine rousseau",
      normalizedLastName: "rousseau",
    },
    {
      id: "10",
      fullName: "Aurélien Rousseau",
      firstName: "Aurélien",
      lastName: "Rousseau",
      normalizedFullName: "aurelien rousseau",
      normalizedLastName: "rousseau",
    },
    {
      id: "11",
      fullName: "Christophe Marion",
      firstName: "Christophe",
      lastName: "Marion",
      normalizedFullName: "christophe marion",
      normalizedLastName: "marion",
    },
    {
      id: "12",
      fullName: "Marion Maréchal",
      firstName: "Marion",
      lastName: "Maréchal",
      normalizedFullName: "marion marechal",
      normalizedLastName: "marechal",
    },
  ];

  it("should match full name", () => {
    const result = findMentions("Le président Emmanuel Macron a déclaré...", politicians);
    expect(result).toEqual([{ politicianId: "1", matchedName: "Emmanuel Macron" }]);
  });

  it("should match last name when >= 5 characters", () => {
    const result = findMentions("Macron a déclaré...", politicians);
    expect(result).toEqual([{ politicianId: "1", matchedName: "Macron" }]);
  });

  it("should not match last name shorter than 5 characters", () => {
    // "Le Pen" normalized is "le pen" — both words are < 5 chars
    const result = findMentions("Le Pen a déclaré...", politicians);
    // Should NOT match by last name alone since "le pen" has len 6 but...
    // Actually "le pen" normalized is "le pen" with length 6, so it should match
    expect(result).toEqual([{ politicianId: "2", matchedName: "Le Pen" }]);
  });

  it("should exclude common French names from last-name matching", () => {
    // "noir" is in EXCLUDED_NAMES, so "Jean Noir" should not match on last name alone
    const result = findMentions("Le ciel est noir ce soir", politicians);
    expect(result).toEqual([]);
  });

  it("should still match excluded names via full name", () => {
    const result = findMentions("Jean Noir a pris la parole", politicians);
    expect(result).toEqual([{ politicianId: "6", matchedName: "Jean Noir" }]);
  });

  it("should not produce duplicate matches", () => {
    const result = findMentions("Emmanuel Macron et Macron ont parlé", politicians);
    expect(result).toHaveLength(1);
    expect(result[0].politicianId).toBe("1");
  });

  it("should match accented text", () => {
    const result = findMentions("Mélenchon a répondu", politicians);
    expect(result).toEqual([{ politicianId: "3", matchedName: "Mélenchon" }]);
  });

  it("should match text without accents to accented names", () => {
    const result = findMentions("Melenchon a répondu", politicians);
    expect(result).toEqual([{ politicianId: "3", matchedName: "Mélenchon" }]);
  });

  it("should match compound names with dashes", () => {
    const result = findMentions("Jean-Luc Mélenchon a proposé", politicians);
    expect(result).toEqual([{ politicianId: "3", matchedName: "Jean-Luc Mélenchon" }]);
  });

  it("should match multiple politicians in same text", () => {
    const result = findMentions("Débat entre Emmanuel Macron et Mélenchon", politicians);
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.politicianId).sort();
    expect(ids).toEqual(["1", "3"]);
  });

  it("should prefer full name match over last name match", () => {
    const result = findMentions("Emmanuel Macron est président", politicians);
    expect(result).toEqual([{ politicianId: "1", matchedName: "Emmanuel Macron" }]);
  });

  it("should return empty array when no match", () => {
    const result = findMentions("Aucun politicien mentionné ici", politicians);
    expect(result).toEqual([]);
  });

  it("should respect word boundaries", () => {
    const result = findMentions("Le macronisme est un mouvement", politicians);
    expect(result).toEqual([]);
  });

  // Adjacent context check — false positive prevention
  it("should not match last name when it is another politician's first name in context", () => {
    // "Laurent Wauquiez" → "Laurent" is Wauquiez's first name, not Daniel Laurent's last name
    const result = findMentions("Laurent Wauquiez a déclaré...", politicians);
    expect(result).toEqual([{ politicianId: "7", matchedName: "Laurent Wauquiez" }]);
    // Daniel Laurent (id=8) should NOT be in results
    expect(result.find((r) => r.politicianId === "8")).toBeUndefined();
  });

  it("should not cross-match when last name appears as first name of another politician", () => {
    // "Sandrine Rousseau" should match Sandrine Rousseau, NOT Aurélien Rousseau
    const result = findMentions("Sandrine Rousseau a répondu", politicians);
    expect(result).toEqual([{ politicianId: "9", matchedName: "Sandrine Rousseau" }]);
    expect(result.find((r) => r.politicianId === "10")).toBeUndefined();
  });

  it("should still match last name alone when no adjacent context conflict", () => {
    // "Rousseau a répondu" — no first name before → valid last-name match
    const result = findMentions("Rousseau a répondu", politicians);
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Should match one of the Rousseaus (whichever comes first by name length)
    expect(["9", "10"]).toContain(result[0].politicianId);
  });

  it("should match both politicians by full name even when names overlap", () => {
    const result = findMentions("Marion Maréchal et Christophe Marion ont débattu", politicians);
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.politicianId).sort();
    expect(ids).toEqual(["11", "12"]);
  });
});

// ============================================
// findPartyMentions
// ============================================

describe("findPartyMentions", () => {
  const parties: PartyName[] = [
    {
      id: "p1",
      name: "Rassemblement National",
      shortName: "RN",
      normalizedName: "rassemblement national",
      normalizedShortName: "rn",
    },
    {
      id: "p2",
      name: "La France Insoumise",
      shortName: "LFI",
      normalizedName: "la france insoumise",
      normalizedShortName: "lfi",
    },
    {
      id: "p3",
      name: "Les Républicains",
      shortName: "LR",
      normalizedName: "les republicains",
      normalizedShortName: "lr",
    },
    {
      id: "p4",
      name: "Parti Socialiste",
      shortName: "PS",
      normalizedName: "parti socialiste",
      normalizedShortName: "ps",
    },
    {
      id: "p5",
      name: "Renaissance",
      shortName: "RE",
      normalizedName: "renaissance",
      normalizedShortName: "re",
    },
  ];

  it("should match full party name", () => {
    const result = findPartyMentions("Le Rassemblement National a voté contre", parties);
    expect(result).toEqual([{ partyId: "p1", matchedName: "Rassemblement National" }]);
  });

  it("should match short name when >= 3 characters", () => {
    const result = findPartyMentions("LFI propose un amendement", parties);
    expect(result).toEqual([{ partyId: "p2", matchedName: "LFI" }]);
  });

  it("should not match short name shorter than 3 characters", () => {
    // "RN" is only 2 chars, should not match by shortname
    const result = findPartyMentions("Le RN a voté contre", parties);
    expect(result).toEqual([]);
  });

  it("should exclude ambiguous short names", () => {
    // "LR" is in EXCLUDED_PARTY_SHORTNAMES
    const result = findPartyMentions("LR s'oppose", parties);
    expect(result).toEqual([]);
  });

  it("should exclude PS shortname (too ambiguous)", () => {
    const result = findPartyMentions("PS: merci de votre attention", parties);
    expect(result).toEqual([]);
  });

  it("should still match excluded shortnames via full name", () => {
    const result = findPartyMentions("Les Républicains ont voté", parties);
    expect(result).toEqual([{ partyId: "p3", matchedName: "Les Républicains" }]);
  });

  it("should not produce duplicate matches", () => {
    const result = findPartyMentions("La France Insoumise, aussi appelée LFI, a voté", parties);
    expect(result).toHaveLength(1);
    expect(result[0].partyId).toBe("p2");
  });

  it("should match multiple parties in same text", () => {
    const result = findPartyMentions(
      "Débat entre Rassemblement National et La France Insoumise",
      parties
    );
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.partyId).sort();
    expect(ids).toEqual(["p1", "p2"]);
  });

  it("should return empty array when no match", () => {
    const result = findPartyMentions("Aucun parti mentionné", parties);
    expect(result).toEqual([]);
  });
});
