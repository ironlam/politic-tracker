import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    statsSnapshot: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { getRotationIndex, getNextCategory, advanceRotation } from "./rotation";
import { db } from "@/lib/db";

const mockFind = vi.mocked(db.statsSnapshot.findUnique);
const mockUpsert = vi.mocked(db.statsSnapshot.upsert);

describe("rotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when no row exists", async () => {
    mockFind.mockResolvedValue(null);
    expect(await getRotationIndex()).toBe(0);
  });

  it("returns stored index", async () => {
    mockFind.mockResolvedValue({ data: { index: 5 } } as any);
    expect(await getRotationIndex()).toBe(5);
  });

  it("wraps around modulo 9", async () => {
    mockFind.mockResolvedValue({ data: { index: 15 } } as any);
    expect(await getRotationIndex()).toBe(6);
  });

  it("getNextCategory returns the category at current index", async () => {
    mockFind.mockResolvedValue({ data: { index: 3 } } as any);
    expect(await getNextCategory()).toBe("affaires");
  });

  it("advanceRotation increments by 1", async () => {
    mockFind.mockResolvedValue({ data: { index: 7 } } as any);
    mockUpsert.mockResolvedValue({} as any);
    await advanceRotation();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ data: { index: 8 } }),
      })
    );
  });

  it("advanceRotation wraps from 8 to 0", async () => {
    mockFind.mockResolvedValue({ data: { index: 8 } } as any);
    mockUpsert.mockResolvedValue({} as any);
    await advanceRotation();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ data: { index: 0 } }),
      })
    );
  });
});
