export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
  url?: string;
  status: "CONFIRMED" | "TENTATIVE";
}

/** Format a Date as YYYYMMDD for all-day ICS events */
export function formatIcsDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Escape text for ICS fields (RFC 5545 §3.3.11) */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Build a single VEVENT block */
export function buildIcsEvent(event: IcsEvent): string {
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsTimestamp(new Date())}`,
    `DTSTART;VALUE=DATE:${formatIcsDate(event.start)}`,
  ];

  if (event.end) {
    // ICS all-day DTEND is exclusive, so add 1 day
    const endExclusive = new Date(event.end);
    endExclusive.setDate(endExclusive.getDate() + 1);
    lines.push(`DTEND;VALUE=DATE:${formatIcsDate(endExclusive)}`);
  } else {
    // Single-day: end = start + 1
    const nextDay = new Date(event.start);
    nextDay.setDate(nextDay.getDate() + 1);
    lines.push(`DTEND;VALUE=DATE:${formatIcsDate(nextDay)}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  lines.push(`STATUS:${event.status}`);
  lines.push("END:VEVENT");

  return lines.join("\r\n");
}

/** Build a full VCALENDAR document */
export function buildIcsCalendar(events: IcsEvent[], calendarName: string): string {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Transparence Politique//Elections//FR",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ].join("\r\n");

  const body = events.map((e) => buildIcsEvent(e)).join("\r\n");
  const footer = "END:VCALENDAR";

  return `${header}\r\n${body}\r\n${footer}\r\n`;
}

/** Format a Date as UTC timestamp for DTSTAMP */
function formatIcsTimestamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}
