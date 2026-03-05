import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod/v4";
import { withValidation } from "@/lib/security/validate";

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("withValidation", () => {
  it("passes validated body to handler on valid input", async () => {
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withValidation(testSchema, handler);

    await wrapped(makeRequest({ name: "Test", age: 25 }), {
      params: Promise.resolve({}),
    });

    expect(handler).toHaveBeenCalledOnce();
    const [, , body] = handler.mock.calls[0]!;
    expect(body).toEqual({ name: "Test", age: 25 });
  });

  it("returns 400 with Zod issues on invalid input", async () => {
    const handler = vi.fn();
    const wrapped = withValidation(testSchema, handler);

    const res = await wrapped(makeRequest({ name: "", age: -1 }), {
      params: Promise.resolve({}),
    });

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation error");
    expect(json.issues).toBeInstanceOf(Array);
    expect(json.issues.length).toBeGreaterThan(0);
    expect(json.issues[0]).toHaveProperty("path");
    expect(json.issues[0]).toHaveProperty("message");
  });

  it("returns 400 on malformed JSON", async () => {
    const handler = vi.fn();
    const wrapped = withValidation(testSchema, handler);

    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      body: "not json",
      headers: { "content-type": "application/json" },
    });

    const res = await wrapped(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it("strips unknown fields", async () => {
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withValidation(testSchema, handler);

    await wrapped(makeRequest({ name: "Test", age: 25, extra: "hack" }), {
      params: Promise.resolve({}),
    });

    const [, , body] = handler.mock.calls[0]!;
    expect(body).toEqual({ name: "Test", age: 25 });
    expect(body).not.toHaveProperty("extra");
  });
});
