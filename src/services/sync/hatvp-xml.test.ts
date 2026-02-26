import { describe, it, expect, beforeAll } from "vitest";
import { parseHATVPXml, parseAmount, isRedacted } from "./hatvp-xml";
import type { DeclarationDetails } from "@/types/hatvp";

const FULL_FIXTURE = `
<declaration>
  <participationFinanciereDto>
    <neant>false</neant>
    <items><items>
      <nomSociete>AXA</nomSociete>
      <evaluation>13520</evaluation>
      <nombreParts>400</nombreParts>
      <capitalDetenu>0</capitalDetenu>
      <remuneration>572 dividendes 2021</remuneration>
      <actiConseil>Non</actiConseil>
    </items></items>
  </participationFinanciereDto>
  <activProfCinqDerniereDto>
    <neant>false</neant>
    <items><items>
      <description>PHARMACIEN</description>
      <employeur>PHARMACIE JENNER</employeur>
      <remuneration>
        <brutNet>Net</brutNet>
        <montant><montant><annee>2023</annee><montant>80000</montant></montant></montant>
      </remuneration>
      <dateDebut>06/2017</dateDebut>
      <dateFin>06/2022</dateFin>
    </items></items>
  </activProfCinqDerniereDto>
  <mandatElectifDto>
    <neant>false</neant>
    <items><items>
      <descriptionMandat>Député de la 7ème circ. de Seine-Maritime</descriptionMandat>
      <remuneration>
        <brutNet>Net</brutNet>
        <montant><montant><annee>2023</annee><montant>62 389</montant></montant></montant>
      </remuneration>
      <dateDebut>06/2022</dateDebut>
      <dateFin></dateFin>
    </items></items>
  </mandatElectifDto>
  <participationDirigeantDto>
    <neant>false</neant>
    <items><items>
      <nomSociete>PHARMACIE JENNER</nomSociete>
      <activite>Pharmacienne titulaire</activite>
      <remuneration>
        <brutNet>Net</brutNet>
        <montant><montant><annee>2023</annee><montant>0</montant></montant></montant>
      </remuneration>
      <dateDebut>06/2017</dateDebut>
      <dateFin>06/2022</dateFin>
    </items></items>
  </participationDirigeantDto>
  <activProfConjointDto>
    <neant>false</neant>
    <items><items>
      <activiteProf>Médecin hospitalier</activiteProf>
      <employeurConjoint>CHU de Rouen</employeurConjoint>
    </items></items>
  </activProfConjointDto>
  <activCollaborateursDto>
    <neant>true</neant>
  </activCollaborateursDto>
</declaration>
`;

describe("parseAmount", () => {
  it("parses simple integers", () => {
    expect(parseAmount("13520")).toBe(13520);
  });

  it("parses French formatted numbers with spaces", () => {
    expect(parseAmount("62 389")).toBe(62389);
    expect(parseAmount("1 234 567")).toBe(1234567);
  });

  it("parses zero", () => {
    expect(parseAmount("0")).toBe(0);
  });

  it("returns null for empty or undefined input", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(undefined as unknown as string)).toBeNull();
    expect(parseAmount(null as unknown as string)).toBeNull();
  });

  it("returns null for non-numeric strings", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("N/A")).toBeNull();
  });

  it("handles numbers passed as actual numbers", () => {
    expect(parseAmount(13520 as unknown as string)).toBe(13520);
  });
});

describe("isRedacted", () => {
  it("detects redacted fields", () => {
    expect(isRedacted("[Données non publiées]")).toBe(true);
  });

  it("returns false for normal text", () => {
    expect(isRedacted("AXA")).toBe(false);
    expect(isRedacted("")).toBe(false);
  });

  it("handles null/undefined gracefully", () => {
    expect(isRedacted(undefined as unknown as string)).toBe(false);
    expect(isRedacted(null as unknown as string)).toBe(false);
  });
});

describe("parseHATVPXml", () => {
  let result: DeclarationDetails;

  beforeAll(() => {
    result = parseHATVPXml(FULL_FIXTURE);
  });

  describe("financial participations", () => {
    it("parses company name", () => {
      expect(result.financialParticipations).toHaveLength(1);
      expect(result.financialParticipations[0].company).toBe("AXA");
    });

    it("parses evaluation as number", () => {
      expect(result.financialParticipations[0].evaluation).toBe(13520);
    });

    it("parses shares count", () => {
      expect(result.financialParticipations[0].shares).toBe(400);
    });

    it("parses capital percentage", () => {
      expect(result.financialParticipations[0].capitalPercent).toBe(0);
    });

    it("parses dividends as string", () => {
      expect(result.financialParticipations[0].dividends).toBe("572 dividendes 2021");
    });

    it("parses board membership (Non → false)", () => {
      expect(result.financialParticipations[0].isBoardMember).toBe(false);
    });

    it("parses board membership (Oui → true)", () => {
      const xml = `
        <declaration>
          <participationFinanciereDto>
            <neant>false</neant>
            <items><items>
              <nomSociete>TEST SA</nomSociete>
              <evaluation>5000</evaluation>
              <nombreParts>100</nombreParts>
              <capitalDetenu>10</capitalDetenu>
              <remuneration></remuneration>
              <actiConseil>Oui</actiConseil>
            </items></items>
          </participationFinanciereDto>
        </declaration>
      `;
      const r = parseHATVPXml(xml);
      expect(r.financialParticipations[0].isBoardMember).toBe(true);
    });
  });

  describe("professional activities", () => {
    it("parses description and employer", () => {
      expect(result.professionalActivities).toHaveLength(1);
      expect(result.professionalActivities[0].description).toBe("PHARMACIEN");
      expect(result.professionalActivities[0].employer).toBe("PHARMACIE JENNER");
    });

    it("parses start and end dates", () => {
      expect(result.professionalActivities[0].startDate).toBe("06/2017");
      expect(result.professionalActivities[0].endDate).toBe("06/2022");
    });

    it("parses annual revenues", () => {
      expect(result.professionalActivities[0].annualRevenues).toEqual([
        { year: 2023, amount: 80000 },
      ]);
    });
  });

  describe("electoral mandates", () => {
    it("parses mandate description", () => {
      expect(result.electoralMandates).toHaveLength(1);
      expect(result.electoralMandates[0].mandate).toBe("Député de la 7ème circ. de Seine-Maritime");
    });

    it("parses start date and null end date", () => {
      expect(result.electoralMandates[0].startDate).toBe("06/2022");
      expect(result.electoralMandates[0].endDate).toBeNull();
    });

    it("parses French formatted revenue amounts", () => {
      expect(result.electoralMandates[0].annualRevenues).toEqual([{ year: 2023, amount: 62389 }]);
    });
  });

  describe("directorships", () => {
    it("parses company and role", () => {
      expect(result.directorships).toHaveLength(1);
      expect(result.directorships[0].company).toBe("PHARMACIE JENNER");
      expect(result.directorships[0].role).toBe("Pharmacienne titulaire");
    });

    it("parses dates", () => {
      expect(result.directorships[0].startDate).toBe("06/2017");
      expect(result.directorships[0].endDate).toBe("06/2022");
    });

    it("parses revenues", () => {
      expect(result.directorships[0].annualRevenues).toEqual([{ year: 2023, amount: 0 }]);
    });
  });

  describe("spouse activity and collaborators", () => {
    it("parses spouse activity as combined string", () => {
      expect(result.spouseActivity).toBe("Médecin hospitalier (CHU de Rouen)");
    });

    it("returns empty collaborators when neant is true", () => {
      expect(result.collaborators).toEqual([]);
    });
  });

  describe("computed summaries", () => {
    it("computes totalPortfolioValue as sum of evaluations", () => {
      expect(result.totalPortfolioValue).toBe(13520);
    });

    it("computes totalCompanies as count of financial participations", () => {
      expect(result.totalCompanies).toBe(1);
    });

    it("computes latestAnnualIncome as sum of all revenues for the most recent year", () => {
      // 2023: 80000 (prof) + 62389 (mandate) + 0 (directorship) = 142389
      expect(result.latestAnnualIncome).toBe(142389);
    });

    it("computes totalDirectorships", () => {
      expect(result.totalDirectorships).toBe(1);
    });
  });

  describe("multiple financial participations", () => {
    it("handles multiple items correctly", () => {
      const xml = `
        <declaration>
          <participationFinanciereDto>
            <neant>false</neant>
            <items>
              <items>
                <nomSociete>AXA</nomSociete>
                <evaluation>13520</evaluation>
                <nombreParts>400</nombreParts>
                <capitalDetenu>0</capitalDetenu>
                <remuneration>572 dividendes</remuneration>
                <actiConseil>Non</actiConseil>
              </items>
              <items>
                <nomSociete>TOTAL</nomSociete>
                <evaluation>25000</evaluation>
                <nombreParts>200</nombreParts>
                <capitalDetenu>1</capitalDetenu>
                <remuneration>1200 dividendes</remuneration>
                <actiConseil>Oui</actiConseil>
              </items>
            </items>
          </participationFinanciereDto>
        </declaration>
      `;
      const r = parseHATVPXml(xml);
      expect(r.financialParticipations).toHaveLength(2);
      expect(r.totalPortfolioValue).toBe(38520);
      expect(r.totalCompanies).toBe(2);
      expect(r.financialParticipations[1].company).toBe("TOTAL");
      expect(r.financialParticipations[1].isBoardMember).toBe(true);
    });
  });

  describe("redacted fields", () => {
    it("treats redacted evaluation as null", () => {
      const xml = `
        <declaration>
          <participationFinanciereDto>
            <neant>false</neant>
            <items><items>
              <nomSociete>SECRET SA</nomSociete>
              <evaluation>[Données non publiées]</evaluation>
              <nombreParts>[Données non publiées]</nombreParts>
              <capitalDetenu>[Données non publiées]</capitalDetenu>
              <remuneration>[Données non publiées]</remuneration>
              <actiConseil>Non</actiConseil>
            </items></items>
          </participationFinanciereDto>
        </declaration>
      `;
      const r = parseHATVPXml(xml);
      expect(r.financialParticipations[0].evaluation).toBeNull();
      expect(r.financialParticipations[0].shares).toBeNull();
      expect(r.financialParticipations[0].capitalPercent).toBeNull();
      expect(r.financialParticipations[0].dividends).toBeNull();
    });

    it("treats redacted revenue amounts as excluded from totals", () => {
      const xml = `
        <declaration>
          <mandatElectifDto>
            <neant>false</neant>
            <items><items>
              <descriptionMandat>Sénateur</descriptionMandat>
              <remuneration>
                <brutNet>Net</brutNet>
                <montant><montant><annee>2023</annee><montant>[Données non publiées]</montant></montant></montant>
              </remuneration>
              <dateDebut>09/2020</dateDebut>
              <dateFin></dateFin>
            </items></items>
          </mandatElectifDto>
        </declaration>
      `;
      const r = parseHATVPXml(xml);
      expect(r.electoralMandates[0].annualRevenues).toEqual([]);
      expect(r.latestAnnualIncome).toBeNull();
    });
  });

  describe("empty sections (neant=true)", () => {
    it("produces empty arrays for all neant sections", () => {
      const xml = `
        <declaration>
          <participationFinanciereDto>
            <neant>true</neant>
          </participationFinanciereDto>
          <activProfCinqDerniereDto>
            <neant>true</neant>
          </activProfCinqDerniereDto>
          <mandatElectifDto>
            <neant>true</neant>
          </mandatElectifDto>
          <participationDirigeantDto>
            <neant>true</neant>
          </participationDirigeantDto>
          <activProfConjointDto>
            <neant>true</neant>
          </activProfConjointDto>
          <activCollaborateursDto>
            <neant>true</neant>
          </activCollaborateursDto>
        </declaration>
      `;
      const r = parseHATVPXml(xml);
      expect(r.financialParticipations).toEqual([]);
      expect(r.professionalActivities).toEqual([]);
      expect(r.electoralMandates).toEqual([]);
      expect(r.directorships).toEqual([]);
      expect(r.spouseActivity).toBeNull();
      expect(r.collaborators).toEqual([]);
      expect(r.totalPortfolioValue).toBeNull();
      expect(r.totalCompanies).toBe(0);
      expect(r.latestAnnualIncome).toBeNull();
      expect(r.totalDirectorships).toBe(0);
    });
  });

  describe("multiple annual revenues", () => {
    it("parses multiple year/amount pairs", () => {
      const xml = `
        <declaration>
          <activProfCinqDerniereDto>
            <neant>false</neant>
            <items><items>
              <description>Avocat</description>
              <employeur>Cabinet X</employeur>
              <remuneration>
                <brutNet>Net</brutNet>
                <montant>
                  <montant><annee>2022</annee><montant>70000</montant></montant>
                  <montant><annee>2023</annee><montant>75000</montant></montant>
                </montant>
              </remuneration>
              <dateDebut>01/2018</dateDebut>
              <dateFin></dateFin>
            </items></items>
          </activProfCinqDerniereDto>
        </declaration>
      `;
      const r = parseHATVPXml(xml);
      expect(r.professionalActivities[0].annualRevenues).toEqual([
        { year: 2022, amount: 70000 },
        { year: 2023, amount: 75000 },
      ]);
    });
  });

  describe("collaborators parsing", () => {
    it("parses collaborators with name and employer", () => {
      const xml = `
        <declaration>
          <activCollaborateursDto>
            <neant>false</neant>
            <items><items>
              <nom>Jean Dupont</nom>
              <employeur>Assemblée nationale</employeur>
            </items></items>
          </activCollaborateursDto>
        </declaration>
      `;
      const r = parseHATVPXml(xml);
      expect(r.collaborators).toEqual([{ name: "Jean Dupont", employer: "Assemblée nationale" }]);
    });

    it("handles multiple collaborators", () => {
      const xml = `
        <declaration>
          <activCollaborateursDto>
            <neant>false</neant>
            <items>
              <items>
                <nom>Jean Dupont</nom>
                <employeur>Assemblée nationale</employeur>
              </items>
              <items>
                <nom>Marie Martin</nom>
                <employeur>Sénat</employeur>
              </items>
            </items>
          </activCollaborateursDto>
        </declaration>
      `;
      const r = parseHATVPXml(xml);
      expect(r.collaborators).toHaveLength(2);
      expect(r.collaborators[1]).toEqual({ name: "Marie Martin", employer: "Sénat" });
    });
  });

  describe("missing sections", () => {
    it("handles completely missing sections gracefully", () => {
      const xml = `<declaration></declaration>`;
      const r = parseHATVPXml(xml);
      expect(r.financialParticipations).toEqual([]);
      expect(r.professionalActivities).toEqual([]);
      expect(r.electoralMandates).toEqual([]);
      expect(r.directorships).toEqual([]);
      expect(r.spouseActivity).toBeNull();
      expect(r.collaborators).toEqual([]);
    });
  });
});
