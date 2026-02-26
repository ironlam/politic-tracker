import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Normalize an image URL to use HTTPS.
 * Fixes Mixed Content warnings from legacy photo URLs stored with http://.
 */
export function normalizeImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://")) {
    return url.replace("http://", "https://");
  }
  return url;
}

export function formatCurrency(amount: number | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactCurrency(value: number | null): string {
  if (value === null || value === 0) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M€`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} k€`;
  return `${value} €`;
}

/**
 * Generate a SEO-friendly slug with date prefix
 * Format: YYYY-MM-DD-titre-slugifie (max 120 characters)
 *
 * Truncates at a word boundary (last `-` before the limit) to avoid
 * cutting in the middle of a word.
 *
 * @param date - The date to prefix the slug with (uses current date if null)
 * @param title - The title to slugify
 * @param maxLength - Maximum total length of the slug (default: 120)
 * @returns A slugified string in format "YYYY-MM-DD-title-slug"
 */
export function generateDateSlug(
  date: Date | null,
  title: string,
  maxLength: number = 120
): string {
  const datePrefix = date
    ? date.toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const titleSlug = generateSlug(title);

  // 10 chars for date (YYYY-MM-DD) + 1 for dash
  const availableLength = maxLength - datePrefix.length - 1;

  let truncatedTitle = titleSlug;
  if (titleSlug.length > availableLength) {
    // Truncate at last word boundary (last dash before limit)
    truncatedTitle = titleSlug.slice(0, availableLength);
    const lastDash = truncatedTitle.lastIndexOf("-");
    if (lastDash > 0) {
      truncatedTitle = truncatedTitle.slice(0, lastDash);
    }
  }

  return `${datePrefix}-${truncatedTitle}`;
}
