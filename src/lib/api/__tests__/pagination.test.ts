import { describe, it, expect } from "vitest";
import { parsePagination } from "../pagination";

describe("parsePagination", () => {
  it("uses defaults when no params", () => {
    const params = new URLSearchParams();
    expect(parsePagination(params)).toEqual({ page: 1, limit: 50, skip: 0 });
  });

  it("parses valid page and limit", () => {
    const params = new URLSearchParams({ page: "3", limit: "20" });
    expect(parsePagination(params)).toEqual({ page: 3, limit: 20, skip: 40 });
  });

  it("clamps page to minimum 1", () => {
    const params = new URLSearchParams({ page: "-5" });
    expect(parsePagination(params).page).toBe(1);
  });

  it("clamps limit to maximum 100", () => {
    const params = new URLSearchParams({ limit: "500" });
    expect(parsePagination(params).limit).toBe(100);
  });

  it("clamps limit to minimum 1", () => {
    const params = new URLSearchParams({ limit: "0" });
    expect(parsePagination(params).limit).toBe(1);
  });

  it("accepts custom default limit", () => {
    const params = new URLSearchParams();
    expect(parsePagination(params, { defaultLimit: 20 }).limit).toBe(20);
  });

  it("accepts custom max limit", () => {
    const params = new URLSearchParams({ limit: "200" });
    expect(parsePagination(params, { maxLimit: 200 }).limit).toBe(200);
  });

  it("handles NaN gracefully", () => {
    const params = new URLSearchParams({ page: "abc", limit: "xyz" });
    expect(parsePagination(params)).toEqual({ page: 1, limit: 50, skip: 0 });
  });
});
