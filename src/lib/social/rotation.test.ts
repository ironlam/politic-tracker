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

// Minimal mock matching the shape read by rotation.ts
function mockRow(index: number) {
  return { data: { index } } as unknown as Awaited<ReturnType<typeof db.statsSnapshot.findUnique>>;
}

describe("rotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when no row exists", async () => {
    mockFind.mockResolvedValue(null);
    expect(await getRotationIndex()).toBe(0);
  });

  it("returns stored index", async () => {
    mockFind.mockResolvedValue(mockRow(5));
    expect(await getRotationIndex()).toBe(5);
  });

  it("wraps around modulo 9", async () => {
    mockFind.mockResolvedValue(mockRow(15));
    expect(await getRotationIndex()).toBe(6);
  });

  it("getNextCategory returns the category at current index", async () => {
    mockFind.mockResolvedValue(mockRow(3));
    expect(await getNextCategory()).toBe("affaires");
  });

  it("advanceRotation increments by 1", async () => {
    mockFind.mockResolvedValue(mockRow(7));
    mockUpsert.mockResolvedValue({} as Awaited<ReturnType<typeof db.statsSnapshot.upsert>>);
    await advanceRotation();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ data: { index: 8 } }),
      })
    );
  });

  it("advanceRotation wraps from 8 to 0", async () => {
    mockFind.mockResolvedValue(mockRow(8));
    mockUpsert.mockResolvedValue({} as Awaited<ReturnType<typeof db.statsSnapshot.upsert>>);
    await advanceRotation();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ data: { index: 0 } }),
      })
    );
  });
});
