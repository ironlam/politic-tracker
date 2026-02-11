"use client";

import { useState, useRef, useEffect } from "react";
import { CalendarPlus } from "lucide-react";
import { buildIcsCalendar, formatIcsDate, type IcsEvent } from "@/lib/ics";

interface AddToCalendarProps {
  title: string;
  round1Date: Date | string;
  round2Date?: Date | string | null;
  slug: string;
  dateConfirmed: boolean;
}

function toDate(d: Date | string): Date {
  return typeof d === "string" ? new Date(d) : d;
}

/** YYYYMMDD for Google Calendar (all-day) */
function googleDate(date: Date): string {
  return formatIcsDate(date);
}

/** Next day YYYYMMDD (Google uses exclusive end) */
function googleDateEnd(date: Date): string {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return formatIcsDate(next);
}

/** YYYY-MM-DD for Outlook */
function outlookDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildGoogleUrl(title: string, date: Date, details: string): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${googleDate(date)}/${googleDateEnd(date)}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function buildOutlookUrl(title: string, date: Date, details: string): string {
  const params = new URLSearchParams({
    subject: title,
    startdt: outlookDate(date),
    enddt: outlookDate(date),
    body: details,
    allday: "true",
    path: "/calendar/action/compose",
  });
  return `https://outlook.live.com/calendar/0/action/compose?${params}`;
}

export function AddToCalendar({
  title,
  round1Date,
  round2Date,
  slug,
  dateConfirmed,
}: AddToCalendarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const r1 = toDate(round1Date);
  const r2 = round2Date ? toDate(round2Date) : null;
  const tentative = dateConfirmed ? "" : " (provisoire)";

  const round1Title = `${title} — Tour 1${tentative}`;
  const round2Title = r2 ? `${title} — Tour 2${tentative}` : "";

  const description = r2
    ? `Tour 1 : ${r1.toLocaleDateString("fr-FR")}\nTour 2 : ${r2.toLocaleDateString("fr-FR")}\n\nhttps://poligraph.fr/elections/${slug}`
    : `https://poligraph.fr/elections/${slug}`;

  function handleDownloadIcs(e: React.MouseEvent) {
    e.preventDefault();
    const events: IcsEvent[] = [
      {
        uid: `election-${slug}-round1@poligraph.fr`,
        summary: round1Title,
        description,
        start: r1,
        url: `https://poligraph.fr/elections/${slug}`,
        status: dateConfirmed ? "CONFIRMED" : "TENTATIVE",
      },
    ];
    if (r2) {
      events.push({
        uid: `election-${slug}-round2@poligraph.fr`,
        summary: round2Title,
        description,
        start: r2,
        url: `https://poligraph.fr/elections/${slug}`,
        status: dateConfirmed ? "CONFIRMED" : "TENTATIVE",
      });
    }
    const ics = buildIcsCalendar(events, title);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Ajouter au calendrier"
      >
        <CalendarPlus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Calendrier</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-md border bg-popover p-1 shadow-md"
        >
          <a
            role="menuitem"
            href={buildGoogleUrl(round1Title, r1, description)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm hover:bg-muted transition-colors"
            onClick={() => setOpen(false)}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google Calendar
          </a>

          <a
            role="menuitem"
            href={buildOutlookUrl(round1Title, r1, description)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm hover:bg-muted transition-colors"
            onClick={() => setOpen(false)}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#0078D4"
                d="M24 7.387v10.478c0 .23-.08.424-.238.576a.806.806 0 01-.588.234h-8.652v-12.1h8.652c.228 0 .422.078.588.234A.778.778 0 0124 7.387zM13.727 18.2H1.455A.77.77 0 01.87 17.96.778.778 0 01.63 17.38V6.62c0-.227.08-.42.238-.576a.77.77 0 01.588-.234h12.272v12.39zM7.09 9.573c-.816 0-1.5.275-2.05.827-.548.55-.823 1.22-.823 2.012v.177c0 .792.275 1.462.824 2.012.55.552 1.233.828 2.05.828.817 0 1.5-.276 2.05-.828.55-.55.824-1.22.824-2.012v-.177c0-.792-.275-1.462-.823-2.012-.55-.552-1.234-.827-2.051-.827z"
              />
            </svg>
            Outlook
          </a>

          <button
            role="menuitem"
            onClick={handleDownloadIcs}
            className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left"
          >
            <CalendarPlus className="w-4 h-4" />
            Télécharger .ics
          </button>
        </div>
      )}
    </div>
  );
}
