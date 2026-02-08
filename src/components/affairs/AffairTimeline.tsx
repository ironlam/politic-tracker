"use client";

import { formatDate } from "@/lib/utils";
import { AFFAIR_EVENT_TYPE_LABELS, AFFAIR_EVENT_TYPE_COLORS } from "@/config/labels";
import type { AffairEvent, AffairEventType } from "@/types";

interface AffairTimelineProps {
  events: AffairEvent[];
}

export function AffairTimeline({ events }: AffairTimelineProps) {
  if (!events || events.length === 0) {
    return null;
  }

  // Sort events by date (oldest first)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="relative">
      <h4 className="font-semibold text-sm mb-4">Chronologie</h4>

      {/* Timeline line */}
      <div className="absolute left-3 top-10 bottom-4 w-0.5 bg-border" aria-hidden="true" />

      <ol className="space-y-4">
        {sortedEvents.map((event, index) => (
          <li key={event.id} className="relative pl-8">
            {/* Timeline dot */}
            <div
              className={`absolute left-0 top-1.5 w-6 h-6 rounded-full flex items-center justify-center ${
                AFFAIR_EVENT_TYPE_COLORS[event.type as AffairEventType] || "bg-gray-500"
              }`}
              aria-hidden="true"
            >
              <span className="text-white text-xs font-bold">{index + 1}</span>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground">
                  {formatDate(event.date)}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-background border">
                  {AFFAIR_EVENT_TYPE_LABELS[event.type as AffairEventType] || event.type}
                </span>
              </div>

              <p className="font-medium text-sm">{event.title}</p>

              {event.description && (
                <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
              )}

              {event.sourceUrl && (
                <a
                  href={event.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                >
                  {event.sourceTitle || "Source"}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="w-3 h-3"
                  >
                    <path d="M6.22 8.72a.75.75 0 0 0 1.06 1.06l5.22-5.22v1.69a.75.75 0 0 0 1.5 0v-3.5a.75.75 0 0 0-.75-.75h-3.5a.75.75 0 0 0 0 1.5h1.69L6.22 8.72Z" />
                    <path d="M3.5 6.75c0-.69.56-1.25 1.25-1.25H7A.75.75 0 0 0 7 4H4.75A2.75 2.75 0 0 0 2 6.75v4.5A2.75 2.75 0 0 0 4.75 14h4.5A2.75 2.75 0 0 0 12 11.25V9a.75.75 0 0 0-1.5 0v2.25c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-4.5Z" />
                  </svg>
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
