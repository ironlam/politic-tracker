import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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

export function formatCurrency(amount: number | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Generate a SEO-friendly slug with date prefix
 * Format: YYYY-MM-DD-titre-slugifie (max 80 characters)
 *
 * @param date - The date to prefix the slug with (uses current date if null)
 * @param title - The title to slugify
 * @param maxLength - Maximum total length of the slug (default: 80)
 * @returns A slugified string in format "YYYY-MM-DD-title-slug"
 */
export function generateDateSlug(
  date: Date | null,
  title: string,
  maxLength: number = 80
): string {
  const datePrefix = date
    ? date.toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const titleSlug = generateSlug(title);

  // 10 chars for date (YYYY-MM-DD) + 1 for dash
  const availableLength = maxLength - datePrefix.length - 1;
  const truncatedTitle = titleSlug.slice(0, availableLength).replace(/-$/, "");

  return `${datePrefix}-${truncatedTitle}`;
}
