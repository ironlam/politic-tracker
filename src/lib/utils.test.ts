import { describe, it, expect } from "vitest";
import { cn, generateSlug, formatDate, formatCurrency, normalizeImageUrl } from "./utils";

describe("cn", () => {
  it("should merge class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("should handle conflicting Tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("should handle conditional classes", () => {
    expect(cn("base", true && "active", false && "hidden")).toBe("base active");
  });

  it("should handle empty inputs", () => {
    expect(cn()).toBe("");
  });
});

describe("normalizeImageUrl", () => {
  it("should return null for null input", () => {
    expect(normalizeImageUrl(null)).toBeNull();
  });

  it("should convert http:// to https://", () => {
    expect(normalizeImageUrl("http://commons.wikimedia.org/photo.jpg")).toBe(
      "https://commons.wikimedia.org/photo.jpg"
    );
  });

  it("should leave https:// URLs unchanged", () => {
    expect(normalizeImageUrl("https://example.com/photo.jpg")).toBe(
      "https://example.com/photo.jpg"
    );
  });

  it("should leave relative URLs unchanged", () => {
    expect(normalizeImageUrl("/images/photo.jpg")).toBe("/images/photo.jpg");
  });
});

describe("generateSlug", () => {
  it("should convert text to lowercase slug", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
  });

  it("should remove accents", () => {
    expect(generateSlug("François Hollande")).toBe("francois-hollande");
    expect(generateSlug("Éric Coquerel")).toBe("eric-coquerel");
  });

  it("should replace special characters with hyphens", () => {
    expect(generateSlug("L'affaire des emplois fictifs")).toBe("l-affaire-des-emplois-fictifs");
  });

  it("should remove leading and trailing hyphens", () => {
    expect(generateSlug("-test-")).toBe("test");
    expect(generateSlug("  test  ")).toBe("test");
  });

  it("should handle multiple consecutive special characters", () => {
    expect(generateSlug("hello   world")).toBe("hello-world");
    expect(generateSlug("test---slug")).toBe("test-slug");
  });

  it("should handle empty string", () => {
    expect(generateSlug("")).toBe("");
  });
});

describe("formatDate", () => {
  it("should format Date object in French locale", () => {
    const date = new Date("2024-01-15");
    const result = formatDate(date);
    expect(result).toContain("janvier");
    expect(result).toContain("2024");
  });

  it("should format date string", () => {
    const result = formatDate("2024-06-20");
    expect(result).toContain("juin");
    expect(result).toContain("2024");
  });

  it("should return dash for null", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("formatCurrency", () => {
  it("should format number as EUR currency", () => {
    const result = formatCurrency(1500);
    expect(result).toContain("1");
    expect(result).toContain("500");
    expect(result).toContain("€");
  });

  it("should format large numbers with thousand separators", () => {
    const result = formatCurrency(1000000);
    // French format uses non-breaking space as thousand separator
    expect(result.replace(/\s/g, "")).toContain("1000000");
  });

  it("should return dash for null", () => {
    expect(formatCurrency(null)).toBe("—");
  });

  it("should handle zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
    expect(result).toContain("€");
  });
});
