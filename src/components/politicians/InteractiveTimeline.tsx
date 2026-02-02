"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Mandate, Affair, MandateType, AffairStatus } from "@/types";
import { MANDATE_TYPE_LABELS, AFFAIR_STATUS_LABELS, AFFAIR_CATEGORY_LABELS } from "@/config/labels";
import {
  MANDATE_TYPE_COLORS,
  AFFAIR_STATUS_MARKER_COLORS,
  getMandateRow,
  MANDATE_ROW_LABELS,
  TIMELINE_CONFIG,
} from "@/config/timeline";
import { formatDate } from "@/lib/utils";

interface InteractiveTimelineProps {
  mandates: Mandate[];
  affairs: Affair[];
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

export function InteractiveTimeline({
  mandates,
  affairs,
  birthDate,
  deathDate,
}: InteractiveTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [focusedElement, setFocusedElement] = useState<string | null>(null);

  // Responsive width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Calculate time range based on CAREER only (not birth date)
  const { minYear, maxYear, timeScale } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Collect career dates only (mandates + affairs)
    const careerDates: Date[] = [];

    mandates.forEach((m) => {
      careerDates.push(new Date(m.startDate));
      if (m.endDate) careerDates.push(new Date(m.endDate));
    });

    affairs.forEach((a) => {
      if (a.verdictDate) careerDates.push(new Date(a.verdictDate));
      else if (a.startDate) careerDates.push(new Date(a.startDate));
      else if (a.factsDate) careerDates.push(new Date(a.factsDate));
    });

    if (careerDates.length === 0) {
      return { minYear: currentYear - 10, maxYear: currentYear, timeScale: () => 0 };
    }

    const years = careerDates.map((d) => d.getFullYear());
    const min = Math.min(...years);
    const max = deathDate
      ? Math.max(new Date(deathDate).getFullYear(), ...years)
      : Math.max(...years, currentYear);

    // Add small padding (2 years before/after)
    const minYear = min - 2;
    const maxYear = max + 2;

    const usableWidth = containerWidth - TIMELINE_CONFIG.margin.left - TIMELINE_CONFIG.margin.right;

    const timeScale = (date: Date): number => {
      const year = date.getFullYear() + date.getMonth() / 12;
      return TIMELINE_CONFIG.margin.left + ((year - minYear) / (maxYear - minYear)) * usableWidth;
    };

    return { minYear, maxYear, timeScale };
  }, [mandates, affairs, deathDate, containerWidth]);

  // Group mandates by row
  const mandatesByRow = useMemo(() => {
    const rows: Map<number, Mandate[]> = new Map();

    mandates.forEach((m) => {
      const row = getMandateRow(m.type);
      if (!rows.has(row)) rows.set(row, []);
      rows.get(row)!.push(m);
    });

    // Filter empty rows and create ordered array
    const orderedRows: { row: number; label: string; mandates: Mandate[] }[] = [];
    for (let i = 0; i < MANDATE_ROW_LABELS.length; i++) {
      if (rows.has(i)) {
        orderedRows.push({
          row: i,
          label: MANDATE_ROW_LABELS[i],
          mandates: rows.get(i)!,
        });
      }
    }

    return orderedRows;
  }, [mandates]);

  // Convert affairs to timeline format
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

  // Calculate SVG height
  const svgHeight = useMemo(() => {
    const { header, rowHeight, affairsRow, padding } = TIMELINE_CONFIG.height;
    const mandateRows = mandatesByRow.length;
    return header + (mandateRows * rowHeight) + (timelineAffairs.length > 0 ? affairsRow : 0) + padding * 2;
  }, [mandatesByRow.length, timelineAffairs.length]);

  // Generate year markers
  const yearMarkers = useMemo(() => {
    const markers: number[] = [];
    for (let year = minYear; year <= maxYear; year += 5) {
      markers.push(year);
    }
    return markers;
  }, [minYear, maxYear]);

  const handleMandateHover = (mandate: Mandate, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const startYear = new Date(mandate.startDate).getFullYear();
    const endYear = mandate.endDate
      ? new Date(mandate.endDate).getFullYear()
      : new Date().getFullYear();

    setTooltip({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top,
      content: (
        <div className="text-left">
          <p className="font-semibold">{MANDATE_TYPE_LABELS[mandate.type]}</p>
          {mandate.constituency && (
            <p className="text-xs text-muted-foreground">{mandate.constituency}</p>
          )}
          <p className="text-xs mt-1">
            {startYear} - {mandate.isCurrent ? "Présent" : endYear}
          </p>
        </div>
      ),
    });
  };

  const handleAffairHover = (affair: TimelineAffair, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    setTooltip({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top,
      content: (
        <div className="text-left">
          <p className="font-semibold">{affair.title}</p>
          <p className="text-xs">
            <Badge
              variant="outline"
              className="text-xs mr-1"
              style={{
                borderColor: AFFAIR_STATUS_MARKER_COLORS[affair.status],
                color: AFFAIR_STATUS_MARKER_COLORS[affair.status],
              }}
            >
              {AFFAIR_STATUS_LABELS[affair.status]}
            </Badge>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {affair.category} - {formatDate(affair.date)}
          </p>
        </div>
      ),
    });
  };

  const handleAffairClick = (affairId: string) => {
    // Scroll to affair section
    const element = document.getElementById(`affair-${affairId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("ring-2", "ring-primary");
      setTimeout(() => {
        element.classList.remove("ring-2", "ring-primary");
      }, 2000);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, type: "mandate" | "affair", id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (type === "affair") {
        handleAffairClick(id);
      }
    }
  };

  if (mandates.length === 0 && affairs.length === 0) {
    return null;
  }

  const { header, rowHeight, barHeight, affairsRow } = TIMELINE_CONFIG.height;
  const baseY = header + 8;

  return (
    <Card>
      <CardHeader>
        <h2 className="leading-none font-semibold">Chronologie</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Vue d&apos;ensemble des mandats et affaires judiciaires
        </p>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="relative overflow-x-auto"
          role="img"
          aria-label={`Chronologie de ${minYear} à ${maxYear} avec ${mandates.length} mandats et ${affairs.length} affaires`}
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

          <svg
            width={containerWidth}
            height={svgHeight}
            className="min-w-[600px]"
            aria-hidden="true"
          >
            {/* Year axis */}
            <g>
              {/* Axis line */}
              <line
                x1={TIMELINE_CONFIG.margin.left}
                y1={header - 5}
                x2={containerWidth - TIMELINE_CONFIG.margin.right}
                y2={header - 5}
                stroke={TIMELINE_CONFIG.style.axisColor}
                strokeWidth={1}
              />

              {/* Year markers */}
              {yearMarkers.map((year) => {
                const x = timeScale(new Date(year, 0, 1));
                return (
                  <g key={year}>
                    <line
                      x1={x}
                      y1={header - 10}
                      x2={x}
                      y2={svgHeight - TIMELINE_CONFIG.height.padding}
                      stroke={TIMELINE_CONFIG.style.axisColor}
                      strokeWidth={1}
                      strokeDasharray="2,4"
                    />
                    <text
                      x={x}
                      y={header - 14}
                      textAnchor="middle"
                      fill={TIMELINE_CONFIG.style.textColor}
                      fontSize={11}
                      fontFamily="system-ui, sans-serif"
                    >
                      {year}
                    </text>
                  </g>
                );
              })}

              {/* Death marker */}
              {deathDate && (
                <g>
                  <circle
                    cx={timeScale(new Date(deathDate))}
                    cy={header - 5}
                    r={4}
                    fill="#6b7280"
                  />
                  <text
                    x={timeScale(new Date(deathDate))}
                    y={header + 10}
                    textAnchor="middle"
                    fill="#6b7280"
                    fontSize={9}
                  >
                    Décès
                  </text>
                </g>
              )}
            </g>

            {/* Mandate rows */}
            {mandatesByRow.map(({ row, label, mandates: rowMandates }, index) => {
              const y = baseY + index * rowHeight;

              return (
                <g key={row}>
                  {/* Row label */}
                  <text
                    x={5}
                    y={y + barHeight / 2 + 4}
                    fill={TIMELINE_CONFIG.style.textColor}
                    fontSize={11}
                    fontFamily="system-ui, sans-serif"
                  >
                    {label}
                  </text>

                  {/* Mandate bars */}
                  {rowMandates.map((mandate) => {
                    const startX = timeScale(new Date(mandate.startDate));
                    const endDate = mandate.endDate
                      ? new Date(mandate.endDate)
                      : deathDate
                        ? new Date(deathDate)
                        : new Date();
                    const endX = timeScale(endDate);
                    const width = Math.max(endX - startX, 4);
                    const color = MANDATE_TYPE_COLORS[mandate.type];
                    const isFocused = focusedElement === `mandate-${mandate.id}`;

                    return (
                      <g key={mandate.id}>
                        <rect
                          x={startX}
                          y={y}
                          width={width}
                          height={barHeight}
                          rx={TIMELINE_CONFIG.style.barRadius}
                          fill={color}
                          opacity={isFocused ? 1 : 0.85}
                          stroke={isFocused ? "#000" : "transparent"}
                          strokeWidth={isFocused ? 2 : 0}
                          className="cursor-pointer transition-opacity"
                          tabIndex={0}
                          role="button"
                          aria-label={`${MANDATE_TYPE_LABELS[mandate.type]}${mandate.constituency ? `, ${mandate.constituency}` : ""}, ${new Date(mandate.startDate).getFullYear()} - ${mandate.isCurrent ? "présent" : mandate.endDate ? new Date(mandate.endDate).getFullYear() : ""}`}
                          onMouseEnter={(e) => handleMandateHover(mandate, e)}
                          onMouseLeave={() => setTooltip(null)}
                          onFocus={() => setFocusedElement(`mandate-${mandate.id}`)}
                          onBlur={() => setFocusedElement(null)}
                          onKeyDown={(e) => handleKeyDown(e, "mandate", mandate.id)}
                        />
                        {/* Current mandate indicator */}
                        {mandate.isCurrent && (
                          <circle
                            cx={endX - 8}
                            cy={y + barHeight / 2}
                            r={4}
                            fill="#22c55e"
                            className="animate-pulse"
                          />
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* Affairs row */}
            {timelineAffairs.length > 0 && (
              <g>
                {/* Row separator */}
                <line
                  x1={TIMELINE_CONFIG.margin.left}
                  y1={baseY + mandatesByRow.length * rowHeight + 4}
                  x2={containerWidth - TIMELINE_CONFIG.margin.right}
                  y2={baseY + mandatesByRow.length * rowHeight + 4}
                  stroke={TIMELINE_CONFIG.style.axisColor}
                  strokeWidth={1}
                />

                {/* Label */}
                <text
                  x={5}
                  y={baseY + mandatesByRow.length * rowHeight + affairsRow / 2 + 4}
                  fill={TIMELINE_CONFIG.style.textColor}
                  fontSize={11}
                  fontFamily="system-ui, sans-serif"
                >
                  Affaires
                </text>

                {/* Affair markers */}
                {timelineAffairs.map((affair, index) => {
                  const x = timeScale(affair.date);
                  const y = baseY + mandatesByRow.length * rowHeight + affairsRow / 2;
                  const color = AFFAIR_STATUS_MARKER_COLORS[affair.status];
                  const isFocused = focusedElement === `affair-${affair.id}`;
                  const size = TIMELINE_CONFIG.style.markerSize;

                  // Offset overlapping markers
                  const samePosition = timelineAffairs
                    .slice(0, index)
                    .filter((a) => Math.abs(timeScale(a.date) - x) < size);
                  const offsetY = samePosition.length * (size + 2);

                  return (
                    <g key={affair.id}>
                      {/* Diamond marker */}
                      <polygon
                        points={`${x},${y - size / 2 + offsetY} ${x + size / 2},${y + offsetY} ${x},${y + size / 2 + offsetY} ${x - size / 2},${y + offsetY}`}
                        fill={color}
                        stroke={isFocused ? "#000" : "white"}
                        strokeWidth={isFocused ? 2 : 1}
                        className="cursor-pointer transition-all"
                        tabIndex={0}
                        role="button"
                        aria-label={`Affaire: ${affair.title}, ${AFFAIR_STATUS_LABELS[affair.status]}, ${formatDate(affair.date)}`}
                        onMouseEnter={(e) => handleAffairHover(affair, e)}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => handleAffairClick(affair.id)}
                        onFocus={() => setFocusedElement(`affair-${affair.id}`)}
                        onBlur={() => setFocusedElement(null)}
                        onKeyDown={(e) => handleKeyDown(e, "affair", affair.id)}
                      />
                    </g>
                  );
                })}
              </g>
            )}
          </svg>

          {/* Screen reader summary */}
          <div className="sr-only">
            <h3>Résumé de la chronologie</h3>
            <p>Période: {minYear} à {maxYear}</p>
            <h4>Mandats ({mandates.length})</h4>
            <ul>
              {mandates.map((m) => (
                <li key={m.id}>
                  {MANDATE_TYPE_LABELS[m.type]}
                  {m.constituency && `, ${m.constituency}`}:
                  {new Date(m.startDate).getFullYear()} -{" "}
                  {m.isCurrent ? "présent" : m.endDate ? new Date(m.endDate).getFullYear() : ""}
                </li>
              ))}
            </ul>
            {affairs.length > 0 && (
              <>
                <h4>Affaires ({affairs.length})</h4>
                <ul>
                  {timelineAffairs.map((a) => (
                    <li key={a.id}>
                      {a.title}: {AFFAIR_STATUS_LABELS[a.status]}, {formatDate(a.date)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span>Mandat en cours</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="w-3 h-3"
              style={{
                backgroundColor: "#991b1b",
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
              }}
            />
            <span>Condamnation définitive</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="w-3 h-3"
              style={{
                backgroundColor: "#f97316",
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
              }}
            />
            <span>Procédure en cours</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="w-3 h-3"
              style={{
                backgroundColor: "#16a34a",
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
              }}
            />
            <span>Relaxe/Acquittement</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
