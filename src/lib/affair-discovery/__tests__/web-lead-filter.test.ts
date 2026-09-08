import { describe, it, expect } from "vitest";
import { screenWebResult, type WebResult } from "../web-lead-filter";

const res = (
  title: string,
  description = "",
  publisher: string | null = "Le Monde"
): WebResult => ({
  title,
  url: "https://example.org/a",
  description,
  publisher,
});

describe("screenWebResult", () => {
  // Les cas de bruit ci-dessous sont RÉELS : relevés dans la file des articles
  // à lier, sur l'échantillon des douze candidats les mieux classés.
  describe("bruit mesuré en production", () => {
    it("écarte l'homonyme d'une affaire criminelle célèbre", () => {
      const d = screenWebResult(
        res("Affaire Xavier Dupont de Ligonnès : que risquent M6 et Julien Courbet"),
        { firstName: "Xavier", lastName: "Dupont" }
      );
      expect(d.keep).toBe(false);
    });

    it("écarte le ministre cité en réaction à l'affaire d'un autre", () => {
      const d = screenWebResult(
        res('Affaire Lyhanna : "Il faut qu\'on incarcère plus", assure Bruno Retailleau'),
        { firstName: "Bruno", lastName: "Retailleau" }
      );
      // Écarté par la porte « aucun terme judiciaire » : « incarcérer » est une
      // opinion de politique pénale, pas une procédure. La porte du tiers est
      // testée séparément, sur un cas qui l'atteint vraiment.
      expect(d.keep).toBe(false);
    });

    it("écarte l'élu cité dans l'affaire d'un tiers, terme judiciaire compris", () => {
      const d = screenWebResult(
        res('Affaire Lyhanna : "un procès nécessaire", estime Bruno Retailleau'),
        { firstName: "Bruno", lastName: "Retailleau" }
      );
      expect(d.keep).toBe(false);
      expect(d.reason).toContain("tiers");
    });

    it("écarte une émission de télévision sans terme judiciaire", () => {
      const d = screenWebResult(res('"Dimanche en politique". Avec Ian Brossat et Maud Bregeon'), {
        firstName: "Maud",
        lastName: "Bregeon",
      });
      expect(d.keep).toBe(false);
      expect(d.reason).toContain("judiciaire");
    });
  });

  describe("vrais signaux", () => {
    it("garde une condamnation nommant l'élu", () => {
      const d = screenWebResult(
        res("Municipales à La Courneuve : condamné pour diffamation, le député Aly Diouara"),
        { firstName: "Aly", lastName: "Diouara" }
      );
      expect(d.keep).toBe(true);
    });

    it("garde une affaire qui porte le nom de l'élu lui-même", () => {
      const d = screenWebResult(
        res("Affaire Afribo : le maire de Rethel jugé pour détournement de fonds"),
        { firstName: "Joseph", lastName: "Afribo" }
      );
      expect(d.keep).toBe(true);
    });

    it("accepte le signal porté par la description seule", () => {
      const d = screenWebResult(
        res("Conseil municipal de Rethel", "Joseph Afribo a été mis en examen mardi."),
        { firstName: "Joseph", lastName: "Afribo" }
      );
      expect(d.keep).toBe(true);
    });
  });

  describe("garde-fous", () => {
    it("écarte tout éditeur hors liste de confiance", () => {
      const d = screenWebResult(res("Afribo condamné", "", null), {
        firstName: "Joseph",
        lastName: "Afribo",
      });
      expect(d.keep).toBe(false);
      expect(d.reason).toContain("confiance");
    });

    it("écarte un résultat qui ne nomme pas l'élu", () => {
      const d = screenWebResult(res("Un maire des Ardennes condamné"), {
        firstName: "Joseph",
        lastName: "Afribo",
      });
      expect(d.keep).toBe(false);
      expect(d.reason).toContain("absent");
    });

    it("écarte les patronymes trop courts pour discriminer", () => {
      const d = screenWebResult(res("Condamnation à Lyon, le tribunal a jugé"), {
        firstName: "Jean",
        lastName: "Le",
      });
      expect(d.keep).toBe(false);
      expect(d.reason).toContain("court");
    });

    it("ignore les accents et la casse", () => {
      const d = screenWebResult(res("MIS EN EXAMEN : Hervé LÉAUTEY devant le tribunal"), {
        firstName: "Hervé",
        lastName: "Léautey",
      });
      expect(d.keep).toBe(true);
    });
  });
});
