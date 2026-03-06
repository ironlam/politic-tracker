import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { OgLayout, OG_SIZE } from "@/lib/og-utils";
import { getPoliticianVotingStats } from "@/services/voteStats";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const politician = await db.politician.findUnique({
    where: { slug },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      photoUrl: true,
      currentParty: {
        select: { name: true, shortName: true, color: true },
      },
      mandates: {
        where: { isCurrent: true },
        take: 1,
        select: { role: true, title: true },
      },
      _count: {
        select: { votes: true, affairs: true, factCheckMentions: true },
      },
    },
  });

  if (!politician) {
    return new Response("Not found", { status: 404 });
  }

  // Get participation rate (non-blocking — fallback to null if no parliamentary mandate)
  let participationRate: number | null = null;
  try {
    const voteStats = await getPoliticianVotingStats(politician.id);
    if (voteStats.total > 0) {
      participationRate = voteStats.participationRate;
    }
  } catch {
    // Non-parliamentary politicians won't have vote stats
  }

  const role = politician.mandates[0]?.role || politician.mandates[0]?.title || "";
  const partyColor = politician.currentParty?.color || "#6366f1";
  const partyName = politician.currentParty?.shortName || politician.currentParty?.name || "";
  const initials = `${politician.firstName[0] || ""}${politician.lastName[0] || ""}`;

  const stats = [
    {
      value: politician._count.votes.toLocaleString("fr-FR"),
      label: "votes",
    },
    ...(participationRate !== null ? [{ value: `${participationRate}%`, label: "partic." }] : []),
    { value: String(politician._count.affairs), label: "affaires" },
    {
      value: String(politician._count.factCheckMentions),
      label: "fact-checks",
    },
  ];

  const img = new ImageResponse(
    <OgLayout>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
          gap: 36,
        }}
      >
        {/* Top: Photo + Info */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          {/* Photo or initials */}
          <div style={{ display: "flex", alignItems: "center", marginRight: 40 }}>
            {politician.photoUrl ? (
              <img
                src={politician.photoUrl}
                width={180}
                height={180}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `5px solid ${partyColor}`,
                }}
              />
            ) : (
              <div
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: "50%",
                  background: partyColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 56,
                  fontWeight: 700,
                }}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Name + role + party */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 42,
                fontWeight: 700,
                color: "white",
                marginBottom: 12,
              }}
            >
              {politician.firstName} {politician.lastName.toUpperCase()}
            </div>
            {role && (
              <div
                style={{
                  fontSize: 24,
                  color: "#94a3b8",
                  marginBottom: 10,
                }}
              >
                {role}
              </div>
            )}
            {partyName && (
              <div style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: partyColor,
                    marginRight: 8,
                  }}
                />
                <div style={{ fontSize: 22, color: partyColor }}>{partyName}</div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Stat boxes */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 20,
          }}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                padding: "20px 16px",
                borderRadius: 12,
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: "white",
                  marginBottom: 4,
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </OgLayout>,
    { ...OG_SIZE }
  );

  return new Response(await img.arrayBuffer(), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="poligraph-${slug}.png"`,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
