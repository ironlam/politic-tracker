/**
 * CSV utility functions for data export
 */

/**
 * Escape a value for CSV format
 */
function escapeCSV(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // If the value contains quotes, commas, or newlines, wrap in quotes and escape quotes
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Convert an array of objects to CSV string
 */
export function toCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; header: string }[]
): string {
  if (data.length === 0) {
    return columns.map((c) => c.header).join(",");
  }

  // Header row
  const header = columns.map((c) => escapeCSV(c.header)).join(",");

  // Data rows
  const rows = data.map((item) =>
    columns.map((c) => escapeCSV(item[c.key] as string | number | boolean | null | undefined)).join(",")
  );

  return [header, ...rows].join("\n");
}

/**
 * Format a date for CSV export (ISO format)
 */
export function formatDateForCSV(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split("T")[0];
}

/**
 * Format a datetime for CSV export
 */
export function formatDateTimeForCSV(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString();
}

/**
 * Create a CSV response with proper headers
 */
export function createCSVResponse(csv: string, filename: string): Response {
  // Add BOM for Excel compatibility with UTF-8
  const bom = "\ufeff";
  const csvWithBom = bom + csv;

  return new Response(csvWithBom, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache",
    },
  });
}
