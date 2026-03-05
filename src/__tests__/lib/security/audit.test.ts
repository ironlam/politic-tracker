import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/security/audit";

describe("getRequestMeta", () => {
  it("extracts IP from x-forwarded-for (first entry)", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getRequestMeta(req).ip).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-real-ip": "9.8.7.6" },
    });
    expect(getRequestMeta(req).ip).toBe("9.8.7.6");
  });

  it("returns unknown when no IP headers", () => {
    const req = new NextRequest("http://localhost/api/test");
    expect(getRequestMeta(req).ip).toBe("unknown");
  });

  it("extracts user-agent", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "user-agent": "Mozilla/5.0" },
    });
    expect(getRequestMeta(req).userAgent).toBe("Mozilla/5.0");
  });

  it("returns all fields", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "TestBot/1.0",
      },
    });
    expect(getRequestMeta(req)).toEqual({
      ip: "1.2.3.4",
      userAgent: "TestBot/1.0",
    });
  });
});
