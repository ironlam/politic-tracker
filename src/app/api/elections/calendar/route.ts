import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildIcsCalendar, type IcsEvent } from "@/lib/ics";

const BASE_URL = "https://transparence-politique.fr";

export async function GET() {
  try {
    const elections = await db.election.findMany({
      where: {
        status: { not: "COMPLETED" },
        round1Date: { not: null },
      },
      orderBy: { round1Date: "asc" },
      select: {
        slug: true,
        title: true,
        description: true,
        round1Date: true,
        round2Date: true,
        dateConfirmed: true,
        scope: true,
      },
    });

    const events: IcsEvent[] = [];

    for (const election of elections) {
      if (!election.round1Date) continue;

      const status = election.dateConfirmed ? "CONFIRMED" : "TENTATIVE";
      const url = `${BASE_URL}/elections/${election.slug}`;
      const tentativeNote = election.dateConfirmed ? "" : " (date provisoire)";

      events.push({
        uid: `election-${election.slug}-round1@transparence-politique.fr`,
        summary: `${election.title} — Tour 1${tentativeNote}`,
        description: election.description ? `${election.description}\n\n${url}` : url,
        start: election.round1Date,
        url,
        status,
      });

      if (election.round2Date) {
        events.push({
          uid: `election-${election.slug}-round2@transparence-politique.fr`,
          summary: `${election.title} — Tour 2${tentativeNote}`,
          description: election.description ? `${election.description}\n\n${url}` : url,
          start: election.round2Date,
          url,
          status,
        });
      }
    }

    const ics = buildIcsCalendar(events, "Élections France");

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="elections-france.ics"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error generating ICS calendar:", error);
    return NextResponse.json({ error: "Failed to generate calendar" }, { status: 500 });
  }
}
