import { describe, it, expect } from "vitest";
import {
  parseWideResultRow,
  reconstructInseeCode,
  parseFrenchDecimal,
  type CommuneResult,
} from "@/services/sync/parse-wide-results";

describe("parseFrenchDecimal", () => {
  it("parses comma-separated French decimals", () => {
    expect(parseFrenchDecimal("64,78")).toBe(64.78);
    expect(parseFrenchDecimal("0,00")).toBe(0);
    expect(parseFrenchDecimal("")).toBe(0);
  });
});

describe("reconstructInseeCode", () => {
  it("pads department and commune codes", () => {
    expect(reconstructInseeCode("1", "4")).toBe("01004");
    expect(reconstructInseeCode("75", "56")).toBe("75056");
    expect(reconstructInseeCode("2A", "14")).toBe("2A014");
  });

  it("maps DOM-TOM codes", () => {
    expect(reconstructInseeCode("ZA", "101")).toBe("97101");
    expect(reconstructInseeCode("ZB", "9")).toBe("97209");
    expect(reconstructInseeCode("ZD", "8")).toBe("97408");
    expect(reconstructInseeCode("ZM", "1")).toBe("97601");
  });
});

describe("parseWideResultRow", () => {
  it("extracts commune info and participation from fixed columns", () => {
    const cols = [
      "75",
      "Paris",
      "56",
      "Paris",
      "100000",
      "40000",
      "40,00",
      "60000",
      "60,00",
      "500",
      "0,50",
      "0,83",
      "200",
      "0,20",
      "0,33",
      "59300",
      "59,30",
      "98,83",
      // List block 1:
      "1",
      "LREM",
      "M",
      "DUPONT",
      "Jean",
      "ENSEMBLE POUR PARIS",
      "20",
      "",
      "5",
      "35000",
      "35,00",
      "59,02",
    ];
    const result: CommuneResult = parseWideResultRow(cols);
    expect(result.inseeCode).toBe("75056");
    expect(result.communeName).toBe("Paris");
    expect(result.registeredVoters).toBe(100000);
    expect(result.actualVoters).toBe(60000);
    expect(result.participationRate).toBeCloseTo(60.0);
    expect(result.blankVotes).toBe(500);
    expect(result.nullVotes).toBe(200);
    expect(result.lists).toHaveLength(1);
    expect(result.lists[0]).toEqual({
      panelNumber: 1,
      nuanceCode: "LREM",
      gender: "M",
      lastName: "DUPONT",
      firstName: "Jean",
      listName: "ENSEMBLE POUR PARIS",
      seatsWon: 20,
      seatsSector: null,
      seatsCC: 5,
      votes: 35000,
      pctRegistered: 35.0,
      pctExpressed: 59.02,
    });
  });

  it("handles multiple list blocks", () => {
    const cols = [
      "1",
      "Ain",
      "1",
      "Amberieu",
      "5000",
      "2000",
      "40,00",
      "3000",
      "60,00",
      "50",
      "1,00",
      "1,67",
      "30",
      "0,60",
      "1,00",
      "2920",
      "58,40",
      "97,33",
      // List 1
      "1",
      "LDVD",
      "M",
      "MARTIN",
      "Pierre",
      "LISTE A",
      "15",
      "",
      "",
      "1800",
      "36,00",
      "61,64",
      // List 2
      "2",
      "LDVG",
      "F",
      "DUVAL",
      "Marie",
      "LISTE B",
      "8",
      "",
      "",
      "1120",
      "22,40",
      "38,36",
    ];
    const result: CommuneResult = parseWideResultRow(cols);
    expect(result.inseeCode).toBe("01001");
    expect(result.lists).toHaveLength(2);
    expect(result.lists[0]!.nuanceCode).toBe("LDVD");
    expect(result.lists[1]!.nuanceCode).toBe("LDVG");
  });
});
