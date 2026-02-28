"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { scaleTime } from "d3-scale";
import { Badge } from "@/components/ui/badge";
import type {
  SerializedMandate,
  SerializedAffairWithSources,
  AffairStatus,
  MandateType,
} from "@/types";
import {
  MANDATE_TYPE_LABELS,
  AFFAIR_STATUS_LABELS,
  AFFAIR_CATEGORY_LABELS,
} from "@/config/labels";
import {
  MANDATE_TYPE_COLORS,
  AFFAIR_STATUS_MARKER_COLORS,
  getMandateRow,
  MANDATE_ROW_LABELS,
} from "@/config/timeline";
import { formatDate } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────

interface CareerTimelineProps {
  mandates: SerializedMandate[];
  partyHistory: {
    id: string;
    startDate: Date;
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

interface TooltipData {
  x: number;
  y: number;
  content: React.ReactNode;
}

interface TimelineAffair {
  id: string;
  title: string;
  date: Date;
  status: AffairStatus;
  category: string;
}

/** A chronological event for the mobile vertical timeline. */
type MobileEvent =
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

const LEFT_MARGIN = 80;
const RIGHT_MARGIN = 20;
const ROW_HEIGHT = 40;
const BAR_HEIGHT = 28;
const MIN_BAR_WIDTH = 4;
const MARKER_SIZE = 14;
const PARTY_BAND_HEIGHT = 20;
const YEAR_AXIS_HEIGHT = 28;

// ─── Helpers ─────────────────────────────────────────────────────────────

function computeDuration(startDate: string | Date, endDate: string | Date | null): string {
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
function computeOverlapOffsets(mandates: SerializedMandate[]): Map<string, number> {
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
      if (start >= lanes[i]) {
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

// ─── Component ───────────────────────────────────────────────────────────

export function CareerTimeline({
  mandates,
  partyHistory,
  affairs,
  birthDate: _birthDate,
  deathDate,
}: CareerTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [isDesktop, setIsDesktop] = useState(true);

  // ─── Responsive detection ───────────────────────────────────────────
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) =>
      setIsDesktop(e.matches);
    handler(mql);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // ─── Container width tracking ───────────────────────────────────────
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ─── Time range (career dates only) ─────────────────────────────────
  const { minDate, maxDate, xScale, renderWidth } = useMemo(() => {
    const now = new Date();
    const careerDates: Date[] = [];

    mandates.forEach((m) => {
      careerDates.push(new Date(m.startDate));
      if (m.endDate) careerDates.push(new Date(m.endDate));
    });
    partyHistory.forEach((ph) => {
      careerDates.push(new Date(ph.startDate));
      if (ph.endDate) careerDates.push(new Date(ph.endDate));
    });
    affairs.forEach((a) => {
      if (a.verdictDate) careerDates.push(new Date(a.verdictDate));
      else if (a.startDate) careerDates.push(new Date(a.startDate));
      else if (a.factsDate) careerDates.push(new Date(a.factsDate));
    });

    if (careerDates.length === 0) {
      const fallbackMin = new Date(now.getFullYear() - 10, 0, 1);
      const fallbackMax = now;
      return {
        minDate: fallbackMin,
        maxDate: fallbackMax,
        renderWidth: containerWidth,
        xScale: scaleTime()
          .domain([fallbackMin, fallbackMax])
          .range([LEFT_MARGIN, containerWidth - RIGHT_MARGIN]),
      };
    }

    const timestamps = careerDates.map((d) => d.getTime());
    const rawMin = new Date(Math.min(...timestamps));
    const rawMax = deathDate
      ? new Date(Math.max(new Date(deathDate).getTime(), ...timestamps))
      : new Date(Math.max(now.getTime(), ...timestamps));

    // Pad 2 years on each side
    const minDate = new Date(rawMin.getFullYear() - 2, 0, 1);
    const maxDate = new Date(rawMax.getFullYear() + 2, 11, 31);

    // Ensure minimum width for very long careers (40px per year)
    const yearSpan = maxDate.getFullYear() - minDate.getFullYear();
    const neededWidth = yearSpan * 40 + LEFT_MARGIN + RIGHT_MARGIN;
    const renderWidth = Math.max(containerWidth, neededWidth);

    const scale = scaleTime()
      .domain([minDate, maxDate])
      .range([LEFT_MARGIN, renderWidth - RIGHT_MARGIN]);

    return { minDate, maxDate, xScale: scale, renderWidth };
  }, [mandates, partyHistory, affairs, deathDate, containerWidth]);

  // ─── Year markers ───────────────────────────────────────────────────
  const yearMarkers = useMemo(() => {
    const markers: number[] = [];
    const startYear = minDate.getFullYear();
    // Round up to nearest 5
    const first = Math.ceil(startYear / 5) * 5;
    for (let y = first; y <= maxDate.getFullYear(); y += 5) {
      markers.push(y);
    }
    return markers;
  }, [minDate, maxDate]);

  // ─── Mandate rows (grouped by category) ────────────────────────────
  const mandateRows = useMemo(() => {
    const rowMap = new Map<number, SerializedMandate[]>();
    mandates.forEach((m) => {
      const row = getMandateRow(m.type);
      if (!rowMap.has(row)) rowMap.set(row, []);
      rowMap.get(row)!.push(m);
    });

    const ordered: {
      row: number;
      label: string;
      mandates: SerializedMandate[];
      overlapOffsets: Map<string, number>;
      maxLanes: number;
    }[] = [];

    for (let i = 0; i < MANDATE_ROW_LABELS.length; i++) {
      if (rowMap.has(i)) {
        const rowMandates = rowMap.get(i)!;
        const offsets = computeOverlapOffsets(rowMandates);
        const maxLanes = Math.max(0, ...offsets.values()) + 1;
        ordered.push({
          row: i,
          label: MANDATE_ROW_LABELS[i],
          mandates: rowMandates,
          overlapOffsets: offsets,
          maxLanes,
        });
      }
    }
    return ordered;
  }, [mandates]);

  // ─── Timeline affairs ───────────────────────────────────────────────
  const timelineAffairs = useMemo((): TimelineAffair[] => {
    return affairs
      .filter((a) => a.verdictDate || a.startDate || a.factsDate)
      .map((a) => ({
        id: a.id,
        title: a.title,
        date: new Date(a.verdictDate || a.startDate || a.factsDate!),
        status: a.status,
        category: AFFAIR_CATEGORY_LABELS[a.category],
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [affairs]);

  // ─── Tooltip handlers ──────────────────────────────────────────────
  const showTooltip = useCallback(
    (event: React.MouseEvent, content: React.ReactNode) => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      const rect = event.currentTarget.getBoundingClientRect();
      setTooltip({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top,
        content,
      });
    },
    []
  );

  const handleMandateHover = useCallback(
    (mandate: SerializedMandate, event: React.MouseEvent) => {
      showTooltip(
        event,
        <div className="text-left">
          <p className="font-semibold">{MANDATE_TYPE_LABELS[mandate.type]}</p>
          {mandate.constituency && (
            <p className="text-xs text-muted-foreground">{mandate.constituency}</p>
          )}
          <p className="text-xs mt-1">
            {formatDate(mandate.startDate)} -{" "}
            {mandate.isCurrent ? "Aujourd'hui" : formatDate(mandate.endDate)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {computeDuration(mandate.startDate, mandate.endDate)}
          </p>
        </div>
      );
    },
    [showTooltip]
  );

  const handleAffairHover = useCallback(
    (affair: TimelineAffair, event: React.MouseEvent) => {
      showTooltip(
        event,
        <div className="text-left max-w-xs">
          <p className="font-semibold">{affair.title}</p>
          <div className="mt-1">
            <Badge
              variant="outline"
              className="text-xs"
              style={{
                borderColor: AFFAIR_STATUS_MARKER_COLORS[affair.status],
                color: AFFAIR_STATUS_MARKER_COLORS[affair.status],
              }}
            >
              {AFFAIR_STATUS_LABELS[affair.status]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {affair.category} - {formatDate(affair.date)}
          </p>
        </div>
      );
    },
    [showTooltip]
  );

  const hideTooltip = useCallback(() => setTooltip(null), []);

  // ─── Empty state ────────────────────────────────────────────────────
  if (mandates.length === 0 && affairs.length === 0 && partyHistory.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aucun mandat enregistré
      </div>
    );
  }

  // ─── Desktop: Horizontal Timeline ──────────────────────────────────
  if (isDesktop) {
    return (
      <DesktopTimeline
        containerRef={containerRef}
        renderWidth={renderWidth}
        tooltip={tooltip}
        xScale={xScale}
        yearMarkers={yearMarkers}
        mandates={mandates}
        mandateRows={mandateRows}
        timelineAffairs={timelineAffairs}
        partyHistory={partyHistory}
        deathDate={deathDate}
        minDate={minDate}
        maxDate={maxDate}
        onMandateHover={handleMandateHover}
        onAffairHover={handleAffairHover}
        onHideTooltip={hideTooltip}
      />
    );
  }

  // ─── Mobile: Vertical Timeline ─────────────────────────────────────
  return (
    <MobileTimeline
      mandates={mandates}
      partyHistory={partyHistory}
      timelineAffairs={timelineAffairs}
      deathDate={deathDate}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Desktop Horizontal Timeline
// ═══════════════════════════════════════════════════════════════════════

function DesktopTimeline({
  containerRef,
  renderWidth,
  tooltip,
  xScale,
  yearMarkers,
  mandates,
  mandateRows,
  timelineAffairs,
  partyHistory,
  deathDate,
  minDate,
  maxDate,
  onMandateHover,
  onAffairHover,
  onHideTooltip,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  renderWidth: number;
  tooltip: TooltipData | null;
  xScale: ReturnType<typeof scaleTime<number, number>>;
  yearMarkers: number[];
  mandates: SerializedMandate[];
  mandateRows: {
    row: number;
    label: string;
    mandates: SerializedMandate[];
    overlapOffsets: Map<string, number>;
    maxLanes: number;
  }[];
  timelineAffairs: TimelineAffair[];
  partyHistory: CareerTimelineProps["partyHistory"];
  deathDate?: Date | null;
  minDate: Date;
  maxDate: Date;
  onMandateHover: (mandate: SerializedMandate, e: React.MouseEvent) => void;
  onAffairHover: (affair: TimelineAffair, e: React.MouseEvent) => void;
  onHideTooltip: () => void;
}) {
  // Calculate total height
  const hasPartyBand = partyHistory.length > 0;
  const hasAffairs = timelineAffairs.length > 0;

  // Compute cumulative y offsets for each row
  let currentY = YEAR_AXIS_HEIGHT;
  if (hasPartyBand) currentY += PARTY_BAND_HEIGHT + 4;

  const rowYPositions: number[] = [];
  for (const { maxLanes } of mandateRows) {
    rowYPositions.push(currentY);
    currentY += maxLanes * ROW_HEIGHT;
  }

  const affairsY = currentY + 8;
  if (hasAffairs) currentY += ROW_HEIGHT + 8;

  const totalHeight = currentY + 8;

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative overflow-x-auto"
        role="img"
        aria-label={`Chronologie politique de ${minDate.getFullYear()} à ${maxDate.getFullYear()} avec ${mandateRows.reduce((sum, r) => sum + r.mandates.length, 0)} mandats${timelineAffairs.length > 0 ? ` et ${timelineAffairs.length} affaires` : ""}`}
      >
        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-50 px-3 py-2 bg-popover text-popover-foreground border rounded-md shadow-lg text-sm pointer-events-none max-w-xs"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: "translate(-50%, -100%)",
            }}
          >
            {tooltip.content}
          </div>
        )}

        <div className="relative" style={{ width: renderWidth, height: totalHeight }}>
          {/* ─── Year axis + vertical guides ─── */}
          {yearMarkers.map((year) => {
            const x = xScale(new Date(year, 0, 1));
            return (
              <div key={year}>
                {/* Year label */}
                <div
                  className="absolute text-xs text-muted-foreground select-none"
                  style={{
                    left: x,
                    top: 0,
                    transform: "translateX(-50%)",
                  }}
                >
                  {year}
                </div>
                {/* Vertical guide line */}
                <div
                  className="absolute border-l border-dashed border-muted-foreground/20"
                  style={{
                    left: x,
                    top: YEAR_AXIS_HEIGHT - 4,
                    height: totalHeight - YEAR_AXIS_HEIGHT,
                  }}
                />
              </div>
            );
          })}

          {/* ─── Death marker ─── */}
          {deathDate && (
            <div
              className="absolute flex flex-col items-center"
              style={{
                left: xScale(new Date(deathDate)),
                top: YEAR_AXIS_HEIGHT - 8,
                transform: "translateX(-50%)",
              }}
            >
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              <span className="text-[9px] text-muted-foreground mt-0.5">
                Décès
              </span>
            </div>
          )}

          {/* ─── Party band ─── */}
          {hasPartyBand &&
            partyHistory.map((ph) => {
              const start = xScale(new Date(ph.startDate));
              const end = xScale(ph.endDate ? new Date(ph.endDate) : new Date());
              const width = Math.max(end - start, MIN_BAR_WIDTH);
              const color = ph.party.color || "#9ca3af";
              return (
                <div
                  key={ph.id}
                  className="absolute rounded-sm"
                  title={ph.party.shortName}
                  style={{
                    left: start,
                    top: YEAR_AXIS_HEIGHT,
                    width,
                    height: PARTY_BAND_HEIGHT,
                    backgroundColor: color,
                    opacity: 0.12,
                  }}
                />
              );
            })}

          {/* ─── Row labels ─── */}
          {mandateRows.map(({ label }, index) => (
            <div
              key={label}
              className="absolute text-xs text-muted-foreground font-medium select-none flex items-center"
              style={{
                left: 0,
                top: rowYPositions[index],
                height: ROW_HEIGHT,
                width: LEFT_MARGIN - 8,
              }}
            >
              {label}
            </div>
          ))}

          {/* ─── Mandate bars ─── */}
          {mandateRows.map(({ mandates: rowMandates, overlapOffsets }, rowIndex) =>
            rowMandates.map((mandate) => {
              const startX = xScale(new Date(mandate.startDate));
              const endDate = mandate.endDate
                ? new Date(mandate.endDate)
                : deathDate
                  ? new Date(deathDate)
                  : new Date();
              const endX = xScale(endDate);
              const width = Math.max(endX - startX, MIN_BAR_WIDTH);
              const color = MANDATE_TYPE_COLORS[mandate.type];
              const laneOffset = overlapOffsets.get(mandate.id) ?? 0;
              const top =
                rowYPositions[rowIndex] +
                laneOffset * ROW_HEIGHT +
                (ROW_HEIGHT - BAR_HEIGHT) / 2;

              return (
                <div
                  key={mandate.id}
                  className="absolute rounded cursor-pointer transition-opacity hover:opacity-100"
                  style={{
                    left: startX,
                    top,
                    width,
                    height: BAR_HEIGHT,
                    backgroundColor: color,
                    opacity: 0.85,
                    borderRadius: 4,
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${MANDATE_TYPE_LABELS[mandate.type]}${mandate.constituency ? `, ${mandate.constituency}` : ""}, ${new Date(mandate.startDate).getFullYear()} - ${mandate.isCurrent ? "présent" : mandate.endDate ? new Date(mandate.endDate).getFullYear() : ""}`}
                  onMouseEnter={(e) => onMandateHover(mandate, e)}
                  onMouseLeave={onHideTooltip}
                >
                  {/* Current mandate pulsing dot */}
                  {mandate.isCurrent && (
                    <span
                      className="absolute w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"
                      style={{
                        right: 4,
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    />
                  )}
                </div>
              );
            })
          )}

          {/* ─── Affairs row ─── */}
          {hasAffairs && (
            <>
              {/* Separator line */}
              <div
                className="absolute border-t border-muted-foreground/15"
                style={{
                  left: LEFT_MARGIN,
                  top: affairsY - 4,
                  width: renderWidth - LEFT_MARGIN - RIGHT_MARGIN,
                }}
              />
              {/* Label */}
              <div
                className="absolute text-xs text-muted-foreground font-medium select-none flex items-center"
                style={{
                  left: 0,
                  top: affairsY,
                  height: ROW_HEIGHT,
                  width: LEFT_MARGIN - 8,
                }}
              >
                Affaires
              </div>
              {/* Affair markers */}
              {timelineAffairs.map((affair, index) => {
                const x = xScale(affair.date);
                const color = AFFAIR_STATUS_MARKER_COLORS[affair.status];

                // Offset overlapping markers
                const prevOverlaps = timelineAffairs
                  .slice(0, index)
                  .filter(
                    (a) =>
                      Math.abs(xScale(a.date) - x) < MARKER_SIZE
                  ).length;
                const offsetY = prevOverlaps * (MARKER_SIZE + 2);

                return (
                  <div
                    key={affair.id}
                    className="absolute cursor-pointer transition-transform hover:scale-125"
                    style={{
                      left: x - MARKER_SIZE / 2,
                      top: affairsY + (ROW_HEIGHT - MARKER_SIZE) / 2 + offsetY,
                      width: MARKER_SIZE,
                      height: MARKER_SIZE,
                      backgroundColor: color,
                      clipPath:
                        "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Affaire: ${affair.title}, ${AFFAIR_STATUS_LABELS[affair.status]}, ${formatDate(affair.date)}`}
                    onMouseEnter={(e) => onAffairHover(affair, e)}
                    onMouseLeave={onHideTooltip}
                  />
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ─── Legend ─── */}
      <TimelineLegend />

      {/* ─── Screen reader summary ─── */}
      <ScreenReaderSummary
        mandates={mandates}
        timelineAffairs={timelineAffairs}
        minYear={minDate.getFullYear()}
        maxYear={maxDate.getFullYear()}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Mobile Vertical Timeline
// ═══════════════════════════════════════════════════════════════════════

function MobileTimeline({
  mandates,
  partyHistory,
  timelineAffairs,
  deathDate,
}: {
  mandates: SerializedMandate[];
  partyHistory: CareerTimelineProps["partyHistory"];
  timelineAffairs: TimelineAffair[];
  deathDate?: Date | null;
}) {
  // Build a merged list of events sorted chronologically (oldest first)
  const events = useMemo((): MobileEvent[] => {
    const all: MobileEvent[] = [];

    mandates.forEach((m) => {
      all.push({ type: "mandate-start", date: new Date(m.startDate), mandate: m });
      if (m.endDate && !m.isCurrent) {
        all.push({ type: "mandate-end", date: new Date(m.endDate), mandate: m });
      }
    });

    partyHistory.forEach((ph) => {
      all.push({ type: "party-change", date: new Date(ph.startDate), party: ph });
    });

    timelineAffairs.forEach((a) => {
      all.push({ type: "affair", date: a.date, affair: a });
    });

    if (deathDate) {
      all.push({ type: "death", date: new Date(deathDate) });
    }

    return all.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [mandates, partyHistory, timelineAffairs, deathDate]);

  const { minYear, maxYear } = useMemo(() => {
    if (events.length === 0) return { minYear: 0, maxYear: 0 };
    return {
      minYear: events[0].date.getFullYear(),
      maxYear: events[events.length - 1].date.getFullYear(),
    };
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aucun mandat enregistré
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative ml-4 border-l-2 border-muted-foreground/20 pl-6 space-y-6">
        {events.map((event, i) => (
          <MobileEventCard key={`${event.type}-${i}`} event={event} />
        ))}
      </div>

      {/* ─── Legend ─── */}
      <TimelineLegend />

      {/* ─── Screen reader summary ─── */}
      <ScreenReaderSummary
        mandates={mandates}
        timelineAffairs={timelineAffairs}
        minYear={minYear}
        maxYear={maxYear}
      />
    </div>
  );
}

function MobileEventCard({ event }: { event: MobileEvent }) {
  switch (event.type) {
    case "mandate-start": {
      const color = MANDATE_TYPE_COLORS[event.mandate.type];
      return (
        <div className="relative">
          <DotMarker color={color} />
          <div className="text-sm">
            <p className="font-medium">
              Début : {MANDATE_TYPE_LABELS[event.mandate.type]}
            </p>
            {event.mandate.constituency && (
              <p className="text-xs text-muted-foreground">
                {event.mandate.constituency}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(event.date)}
            </p>
            {event.mandate.isCurrent && (
              <Badge variant="outline" className="text-xs mt-1 border-green-500 text-green-600">
                En cours
              </Badge>
            )}
          </div>
        </div>
      );
    }
    case "mandate-end": {
      return (
        <div className="relative">
          <DotMarker color="#9ca3af" />
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">
              Fin : {MANDATE_TYPE_LABELS[event.mandate.type]}
            </p>
            {event.mandate.constituency && (
              <p className="text-xs text-muted-foreground">
                {event.mandate.constituency}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(event.date)}
            </p>
          </div>
        </div>
      );
    }
    case "party-change": {
      const color = event.party.party.color || "#9ca3af";
      return (
        <div className="relative">
          <DotMarker color={color} />
          <div className="text-sm">
            <p className="font-medium">
              Rejoint {event.party.party.shortName}
            </p>
            <p className="text-xs text-muted-foreground">
              {event.party.party.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(event.date)}
            </p>
          </div>
        </div>
      );
    }
    case "affair": {
      const color = AFFAIR_STATUS_MARKER_COLORS[event.affair.status];
      return (
        <div className="relative">
          <DiamondMarker color={color} />
          <div className="text-sm">
            <p className="font-medium">{event.affair.title}</p>
            <div className="mt-1">
              <Badge
                variant="outline"
                className="text-xs"
                style={{
                  borderColor: color,
                  color: color,
                }}
              >
                {AFFAIR_STATUS_LABELS[event.affair.status]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {event.affair.category} - {formatDate(event.date)}
            </p>
          </div>
        </div>
      );
    }
    case "death": {
      return (
        <div className="relative">
          <DotMarker color="#6b7280" />
          <div className="text-sm">
            <p className="font-medium text-muted-foreground">Décès</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(event.date)}
            </p>
          </div>
        </div>
      );
    }
  }
}

/** Circular dot positioned on the vertical line (mobile). */
function DotMarker({ color }: { color: string }) {
  return (
    <span
      className="absolute -left-[31px] top-1 w-3 h-3 rounded-full border-2 border-background"
      style={{ backgroundColor: color }}
    />
  );
}

/** Diamond marker positioned on the vertical line (mobile). */
function DiamondMarker({ color }: { color: string }) {
  return (
    <span
      className="absolute -left-[31px] top-1 w-3 h-3 border-2 border-background"
      style={{
        backgroundColor: color,
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Screen reader summary (shared between desktop and mobile)
// ═══════════════════════════════════════════════════════════════════════

function ScreenReaderSummary({
  mandates,
  timelineAffairs,
  minYear,
  maxYear,
}: {
  mandates: SerializedMandate[];
  timelineAffairs: TimelineAffair[];
  minYear: number;
  maxYear: number;
}) {
  return (
    <div className="sr-only">
      <h3>Résumé de la chronologie</h3>
      <p>
        Période : {minYear} à {maxYear}
      </p>
      <h4>Mandats ({mandates.length})</h4>
      <ul>
        {mandates.map((m) => (
          <li key={m.id}>
            {MANDATE_TYPE_LABELS[m.type]}
            {m.constituency && `, ${m.constituency}`} :{" "}
            {new Date(m.startDate).getFullYear()} -{" "}
            {m.isCurrent ? "présent" : m.endDate ? new Date(m.endDate).getFullYear() : ""}
          </li>
        ))}
      </ul>
      {timelineAffairs.length > 0 && (
        <>
          <h4>Affaires ({timelineAffairs.length})</h4>
          <ul>
            {timelineAffairs.map((a) => (
              <li key={a.id}>
                {a.title} : {AFFAIR_STATUS_LABELS[a.status]}, {formatDate(a.date)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Legend (shared between desktop and mobile)
// ═══════════════════════════════════════════════════════════════════════

const LEGEND_MANDATES: { type: MandateType; label: string }[] = [
  { type: "PRESIDENT_REPUBLIQUE", label: "Exécutif" },
  { type: "DEPUTE", label: "Député" },
  { type: "SENATEUR", label: "Sénateur" },
  { type: "MAIRE", label: "Maire" },
  { type: "PRESIDENT_PARTI", label: "Dirigeant de parti" },
];

const LEGEND_AFFAIRS: { status: AffairStatus; label: string }[] = [
  { status: "CONDAMNATION_DEFINITIVE", label: "Condamnation" },
  { status: "PROCES_EN_COURS", label: "Procédure en cours" },
  { status: "RELAXE", label: "Relaxe" },
];

function TimelineLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground pt-2 border-t border-muted-foreground/10">
      {/* Mandate type colors */}
      {LEGEND_MANDATES.map(({ type, label }) => (
        <div key={type} className="flex items-center gap-1.5">
          <span
            className="w-3 h-2 rounded-sm inline-block"
            style={{ backgroundColor: MANDATE_TYPE_COLORS[type] }}
          />
          <span>{label}</span>
        </div>
      ))}

      {/* Separator */}
      <span className="text-muted-foreground/30">|</span>

      {/* Affair status markers */}
      {LEGEND_AFFAIRS.map(({ status, label }) => (
        <div key={status} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 inline-block"
            style={{
              backgroundColor: AFFAIR_STATUS_MARKER_COLORS[status],
              clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
            }}
          />
          <span>{label}</span>
        </div>
      ))}

      {/* Separator */}
      <span className="text-muted-foreground/30">|</span>

      {/* Current mandate indicator */}
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse inline-block" />
        <span>Mandat en cours</span>
      </div>
    </div>
  );
}
