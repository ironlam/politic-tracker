import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock est remonté en tête de fichier : la factory ne peut pas voir une
// variable déclarée après, d'où vi.hoisted.
const { updateMany } = vi.hoisted(() => ({ updateMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { moderationReview: { updateMany } } }));

import { closeModerationReviews } from "../close-moderation-reviews";

describe("closeModerationReviews", () => {
  beforeEach(() => {
    updateMany.mockReset();
    updateMany.mockResolvedValue({ count: 0 });
  });

  it("ne touche que les revues des affaires passées", async () => {
    await closeModerationReviews(["a1", "a2"], "Poligraph Moderation");

    expect(updateMany).toHaveBeenCalledTimes(1);
    const arg = updateMany.mock.calls[0]![0];
    expect(arg.where.affairId).toEqual({ in: ["a1", "a2"] });
  });

  it("laisse intacte une revue déjà appliquée", async () => {
    await closeModerationReviews(["a1"], "Poligraph Moderation");

    // Sans ce filtre, re-trancher une affaire réécrirait qui a appliqué quoi.
    expect(updateMany.mock.calls[0]![0].where.appliedAt).toBeNull();
  });

  it("enregistre le décideur", async () => {
    await closeModerationReviews(["a1"], "auto-triage-v9");

    expect(updateMany.mock.calls[0]![0].data.appliedBy).toBe("auto-triage-v9");
    expect(updateMany.mock.calls[0]![0].data.appliedAt).toBeInstanceOf(Date);
  });

  it("renvoie le nombre réellement écrit, pas la taille du lot", async () => {
    updateMany.mockResolvedValue({ count: 1 });

    // Le lot vaut 3 : renvoyer 3 masquerait une écriture partielle.
    await expect(closeModerationReviews(["a1", "a2", "a3"], "x")).resolves.toBe(1);
  });

  it("n'émet aucune requête sur un lot vide", async () => {
    await expect(closeModerationReviews([], "x")).resolves.toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
