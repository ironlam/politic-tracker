import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Toute route admin qui tranche le statut d'une affaire EXISTANTE doit clore
 * ses revues de modération.
 *
 * `ModerationReview.appliedAt` gouverne toutes les files de modération et
 * n'était écrit par aucun chemin : la file grossissait à chaque décision
 * éditoriale. Le correctif a d'abord manqué un quatrième chemin, celui du
 * formulaire d'édition complet, parce que la recherche des appelants avait été
 * tronquée. Ce test teste la propriété sur tout le corpus plutôt que de faire
 * confiance à une énumération.
 */

const ADMIN_API = "src/app/api/admin";

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

/**
 * Exceptions, avec leur raison. Une affaire qui vient d'être créée ne porte
 * aucune revue, il n'y a donc rien à clore.
 */
const EXEMPT: Record<string, string> = {
  "src/app/api/admin/slapp/import/route.ts":
    "crée l'affaire en DRAFT ; sa branche update ne touche que les champs SLAPP",
  "src/app/api/admin/press/rejections/recover/route.ts":
    "crée une affaire en DRAFT depuis un rejet presse",
};

describe("clôture des revues de modération", () => {
  const files = routeFiles(ADMIN_API);

  it("trouve bien les routes admin à inspecter", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("toute route qui publie une affaire existante clôt ses revues", () => {
    const manquantes: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // `assertPublishable` ne s'appelle que pour faire passer une affaire
      // existante à PUBLISHED : c'est le marqueur le plus fiable d'une décision.
      const decides = src.includes("assertPublishable(");
      if (!decides) continue;
      if (EXEMPT[file]) continue;
      if (!src.includes("closeModerationReviews")) manquantes.push(file);
    }

    expect(manquantes, `routes qui tranchent sans clore :\n${manquantes.join("\n")}`).toEqual([]);
  });

  it("les quatre chemins de décision connus sont bien couverts", () => {
    // Énumération explicite en plus de la propriété : si l'un disparaît ou
    // change de nom, le test le dit au lieu de passer sur un corpus réduit.
    const attendus = [
      "src/app/api/admin/affaires/moderate/route.ts",
      "src/app/api/admin/affaires/bulk/route.ts",
      "src/app/api/admin/affaires/[id]/quick-update/route.ts",
      "src/app/api/admin/affaires/[id]/route.ts",
    ];
    for (const f of attendus) {
      expect(readFileSync(f, "utf8"), f).toContain("closeModerationReviews");
    }
  });

  it("les exceptions déclarées existent encore", () => {
    for (const f of Object.keys(EXEMPT)) {
      expect(() => readFileSync(f, "utf8"), `exception obsolète : ${f}`).not.toThrow();
    }
  });
});
