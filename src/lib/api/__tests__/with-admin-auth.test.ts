import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  isAuthenticated: vi.fn(),
}));

import { withAdminAuth } from "../with-admin-auth";
import { isAuthenticated } from "@/lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("withAdminAuth", () => {
  const mockRequest = new NextRequest("http://localhost/api/admin/test");
  const mockContext = { params: Promise.resolve({ id: "123" }) };

  it("returns 401 when not authenticated", async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    const handler = vi.fn();
    const wrapped = withAdminAuth(handler);
    const result = await wrapped(mockRequest, mockContext);
    const body = await result.json();
    expect(result.status).toBe(401);
    expect(body.error).toBe("Non autorisé");
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler when authenticated", async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    const { NextResponse } = await import("next/server");
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAdminAuth(handler);
    const result = await wrapped(mockRequest, mockContext);
    expect(handler).toHaveBeenCalledWith(mockRequest, mockContext);
    const body = await result.json();
    expect(body.ok).toBe(true);
  });

  it("catches errors and returns 500", async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    const handler = vi.fn().mockRejectedValue(new Error("DB down"));
    const wrapped = withAdminAuth(handler);
    const result = await wrapped(mockRequest, mockContext);
    const body = await result.json();
    expect(result.status).toBe(500);
    expect(body.error).toBe("Erreur interne");
  });
});
