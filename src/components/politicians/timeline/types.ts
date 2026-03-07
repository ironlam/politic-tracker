import type { SerializedMandate, SerializedAffairWithSources, AffairStatus } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────

export interface CareerTimelineProps {
  mandates: SerializedMandate[];
  partyHistory: {
    id: string;
    startDate: Date | null;
    endDate: Date | null;
    role: string;
    party: {
      name: string;
      shortName: string;
      slug: string | null;
      color: string | null;
    };
  }[];
  affairs: SerializedAffairWithSources[];
  birthDate?: Date | null;
  deathDate?: Date | null;
}

export interface TooltipData {
  x: number;
  y: number;
  content: React.ReactNode;
}

export interface TimelineAffair {
  id: string;
  title: string;
  date: Date;
  status: AffairStatus;
  category: string;
}

/** A chronological event for the mobile vertical timeline. */
export type MobileEvent =
  | { type: "mandate-start"; date: Date; mandate: SerializedMandate }
  | { type: "mandate-end"; date: Date; mandate: SerializedMandate }
  | {
      type: "party-change";
      date: Date;
      party: CareerTimelineProps["partyHistory"][number];
    }
  | { type: "affair"; date: Date; affair: TimelineAffair }
  | { type: "death"; date: Date };

// ─── Sizing constants ────────────────────────────────────────────────────

export const LEFT_MARGIN = 80;
export const RIGHT_MARGIN = 20;
export const ROW_HEIGHT = 40;
export const BAR_HEIGHT = 28;
export const MIN_BAR_WIDTH = 4;
export const MARKER_SIZE = 14;
export const PARTY_BAND_HEIGHT = 20;
export const YEAR_AXIS_HEIGHT = 28;
