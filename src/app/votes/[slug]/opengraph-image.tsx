import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { OgLayout, OgCategoryLabel, OgBadge, OG_SIZE, truncateOg } from "@/lib/og-utils";

export const alt = "Vote parlementaire sur Poligraph";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Try slug, then id fallback
  let scrutin = await db.scrutin.findUnique({
    where: { slug },
    select: {
      title: true,
      votingDate: true,
      result: true,
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
        votesFor: true,
        votesAgainst: true,
        votesAbstain: true,
      },
    });
  }

  if (!scrutin) {
    return new ImageResponse(
      <OgLayout>
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 32,
          }}
        >
          Scrutin non trouvé
        </div>
      </OgLayout>,
      { ...OG_SIZE }
    );
  }

  const isAdopted = scrutin.result === "ADOPTED";
  const resultLabel = isAdopted ? "Adopté" : "Rejeté";
  const resultColor = isAdopted ? "#22c55e" : "#ef4444";
  const total = scrutin.votesFor + scrutin.votesAgainst + scrutin.votesAbstain;
  const forPct = total > 0 ? Math.round((scrutin.votesFor / total) * 100) : 0;
  const againstPct = total > 0 ? Math.round((scrutin.votesAgainst / total) * 100) : 0;
  const abstainPct = total > 0 ? 100 - forPct - againstPct : 0;
  const date = new Date(scrutin.votingDate).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return new ImageResponse(
    <OgLayout>
      <OgCategoryLabel emoji="🗳️" label="Vote" />

      {/* Date */}
      <div style={{ fontSize: 20, color: "#64748b", marginBottom: 12 }}>{date}</div>

      {/* Title */}
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: "white",
          marginBottom: 24,
        }}
      >
        {truncateOg(scrutin.title, 130)}
      </div>

      {/* Result badge */}
      <div style={{ display: "flex", marginBottom: 28 }}>
        <OgBadge label={resultLabel} color={resultColor} />
      </div>

      {/* Vote bar */}
      {total > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", height: 32, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ width: `${forPct}%`, background: "#22c55e" }} />
            <div style={{ width: `${againstPct}%`, background: "#ef4444" }} />
            <div style={{ width: `${abstainPct}%`, background: "#64748b" }} />
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: 22, color: "#94a3b8" }}>
            <span style={{ color: "#22c55e" }}>Pour {scrutin.votesFor}</span>
            <span style={{ color: "#ef4444" }}>Contre {scrutin.votesAgainst}</span>
            <span style={{ color: "#64748b" }}>Abstention {scrutin.votesAbstain}</span>
          </div>
        </div>
      )}
    </OgLayout>,
    { ...OG_SIZE }
  );
}
