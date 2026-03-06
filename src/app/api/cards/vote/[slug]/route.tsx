import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { OgLayout, OgCategoryLabel, OgBadge, OG_SIZE, truncateOg } from "@/lib/og-utils";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Try slug first, then id fallback (same as OG image)
  let scrutin = await db.scrutin.findUnique({
    where: { slug },
    select: {
      title: true,
      votingDate: true,
      result: true,
      chamber: true,
      votesFor: true,
      votesAgainst: true,
      votesAbstain: true,
    },
  });
  if (!scrutin) {
    scrutin = await db.scrutin.findUnique({
      where: { id: slug },
      select: {
        title: true,
        votingDate: true,
        result: true,
        chamber: true,
        votesFor: true,
        votesAgainst: true,
        votesAbstain: true,
      },
    });
  }

  if (!scrutin) {
    return new Response("Not found", { status: 404 });
  }

  const isAdopted = scrutin.result === "ADOPTED";
  const resultLabel = isAdopted ? "Adopté" : "Rejeté";
  const resultColor = isAdopted ? "#22c55e" : "#ef4444";
  const chamberLabel = scrutin.chamber === "AN" ? "Assemblée nationale" : "Sénat";
  const total = scrutin.votesFor + scrutin.votesAgainst + scrutin.votesAbstain;
  const forPct = total > 0 ? Math.round((scrutin.votesFor / total) * 100) : 0;
  const againstPct = total > 0 ? Math.round((scrutin.votesAgainst / total) * 100) : 0;
  const abstainPct = total > 0 ? 100 - forPct - againstPct : 0;
  const date = new Date(scrutin.votingDate).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const img = new ImageResponse(
    <OgLayout>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
        }}
      >
        <OgCategoryLabel emoji="🗳️" label={`Vote · ${chamberLabel}`} />

        {/* Date */}
        <div style={{ fontSize: 20, color: "#64748b", marginBottom: 16 }}>{date}</div>

        {/* Title */}
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: "white",
            marginBottom: 28,
            lineHeight: 1.3,
          }}
        >
          {truncateOg(scrutin.title, 140)}
        </div>

        {/* Result badge + vote bar */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 24,
            marginBottom: 24,
          }}
        >
          <OgBadge label={resultLabel} color={resultColor} />
        </div>

        {/* Vote bar */}
        {total > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                display: "flex",
                height: 36,
                borderRadius: 18,
                overflow: "hidden",
              }}
            >
              <div style={{ width: `${forPct}%`, background: "#22c55e" }} />
              <div style={{ width: `${againstPct}%`, background: "#ef4444" }} />
              <div style={{ width: `${abstainPct}%`, background: "#64748b" }} />
            </div>
            <div
              style={{
                display: "flex",
                gap: 32,
                fontSize: 22,
                color: "#94a3b8",
              }}
            >
              <span style={{ color: "#22c55e" }}>Pour {scrutin.votesFor}</span>
              <span style={{ color: "#ef4444" }}>Contre {scrutin.votesAgainst}</span>
              <span style={{ color: "#64748b" }}>Abstention {scrutin.votesAbstain}</span>
            </div>
          </div>
        )}
      </div>
    </OgLayout>,
    { ...OG_SIZE }
  );

  return new Response(await img.arrayBuffer(), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="poligraph-vote-${slug}.png"`,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
