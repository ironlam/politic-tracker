import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const alt = "Vote parlementaire sur Poligraph";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Try slug, then id, then externalId
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
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1e3a5f 0%, #0f1f3a 100%)",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 32,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Scrutin non trouvé
      </div>,
      { ...size }
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #1e3a5f 0%, #0f1f3a 100%)",
        padding: 60,
        fontFamily: "system-ui, sans-serif",
        justifyContent: "center",
      }}
    >
      {/* Date */}
      <div style={{ fontSize: 22, color: "#64748b", marginBottom: 16 }}>{date}</div>

      {/* Title */}
      <div
        style={{
          fontSize: 38,
          fontWeight: 700,
          color: "white",
          marginBottom: 24,
          lineClamp: 3,
          overflow: "hidden",
          maxHeight: 160,
        }}
      >
        {scrutin.title.length > 120 ? scrutin.title.slice(0, 120) + "..." : scrutin.title}
      </div>

      {/* Result badge */}
      <div style={{ display: "flex", marginBottom: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 24px",
            borderRadius: 999,
            background: `${resultColor}22`,
            border: `2px solid ${resultColor}`,
            color: resultColor,
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          {resultLabel}
        </div>
      </div>

      {/* Vote bar */}
      {total > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", height: 24, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ width: `${forPct}%`, background: "#22c55e" }} />
            <div style={{ width: `${againstPct}%`, background: "#ef4444" }} />
            <div style={{ width: `${abstainPct}%`, background: "#64748b" }} />
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: 20, color: "#94a3b8" }}>
            <span style={{ color: "#22c55e" }}>Pour {scrutin.votesFor}</span>
            <span style={{ color: "#ef4444" }}>Contre {scrutin.votesAgainst}</span>
            <span style={{ color: "#64748b" }}>Abstention {scrutin.votesAbstain}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ fontSize: 20, color: "#475569", marginTop: "auto" }}>poligraph.fr</div>
    </div>,
    { ...size }
  );
}
