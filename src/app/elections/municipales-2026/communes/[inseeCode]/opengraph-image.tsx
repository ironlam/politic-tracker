import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const alt = "Municipales 2026 sur Poligraph";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ inseeCode: string }> }) {
  const { inseeCode } = await params;

  const commune = await db.commune.findUnique({
    where: { id: inseeCode },
    select: {
      name: true,
      departmentCode: true,
      departmentName: true,
      population: true,
    },
  });

  if (!commune) {
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
        Commune non trouvée
      </div>,
      { ...size }
    );
  }

  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true },
  });

  let listCount = 0;
  let candidateCount = 0;
  if (election) {
    const stats = await db.candidacy.aggregate({
      where: { electionId: election.id, communeId: inseeCode },
      _count: true,
    });
    candidateCount = stats._count;

    const lists = await db.candidacy.groupBy({
      by: ["listName"],
      where: { electionId: election.id, communeId: inseeCode },
    });
    listCount = lists.length;
  }

  const populationFormatted = commune.population
    ? commune.population.toLocaleString("fr-FR")
    : null;

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
      {/* Type badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <span style={{ fontSize: 36 }}>🏛️</span>
        <span
          style={{
            fontSize: 22,
            color: "#64748b",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          Municipales 2026
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 46,
          fontWeight: 700,
          color: "white",
          marginBottom: 24,
        }}
      >
        {commune.name.length > 60
          ? `Municipales 2026 à ${commune.name.slice(0, 40)}...`
          : `Municipales 2026 à ${commune.name}`}
      </div>

      {/* Department badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 24px",
            borderRadius: 999,
            background: "#3b82f622",
            border: "2px solid #3b82f6",
            color: "#3b82f6",
            fontSize: 24,
            fontWeight: 600,
          }}
        >
          {commune.departmentName} ({commune.departmentCode})
        </div>
      </div>

      {/* Stats line */}
      {(listCount > 0 || candidateCount > 0) && (
        <div
          style={{
            display: "flex",
            gap: 8,
            fontSize: 22,
            color: "#94a3b8",
            marginBottom: 12,
          }}
        >
          <span>📋</span>
          <span>
            {listCount} liste{listCount > 1 ? "s" : ""} · {candidateCount} candidat
            {candidateCount > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Population */}
      {populationFormatted && (
        <div
          style={{
            display: "flex",
            gap: 8,
            fontSize: 22,
            color: "#94a3b8",
          }}
        >
          <span>👥</span>
          <span>{populationFormatted} habitants</span>
        </div>
      )}

      {/* Footer */}
      <div style={{ fontSize: 20, color: "#475569", marginTop: "auto" }}>poligraph.fr</div>
    </div>,
    { ...size }
  );
}
