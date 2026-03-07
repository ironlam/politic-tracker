import type { SerializedMandate } from "@/types";

export function computeDuration(startDate: string | Date, endDate: string | Date | null): string {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const totalMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months} mois`;
  if (months === 0) return `${years} an${years > 1 ? "s" : ""}`;
  return `${years} an${years > 1 ? "s" : ""} et ${months} mois`;
}

/**
 * Detect overlapping mandates within a row and assign a sub-row offset index.
 * Returns a Map from mandate.id to offset (0 = first lane, 1 = second, etc.).
 */
export function computeOverlapOffsets(mandates: SerializedMandate[]): Map<string, number> {
  const sorted = [...mandates].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  // Each lane tracks its current end date
  const lanes: Date[] = [];
  const offsets = new Map<string, number>();

  for (const m of sorted) {
    const start = new Date(m.startDate);
    // Find first lane where our start >= lane end
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      if (start >= lanes[i]!) {
        lanes[i] = m.endDate ? new Date(m.endDate) : new Date();
        offsets.set(m.id, i);
        placed = true;
        break;
      }
    }
    if (!placed) {
      offsets.set(m.id, lanes.length);
      lanes.push(m.endDate ? new Date(m.endDate) : new Date());
    }
  }
  return offsets;
}
