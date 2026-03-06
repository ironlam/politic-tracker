import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { OgLayout, OgCategoryLabel, OG_SIZE } from "@/lib/og-utils";
import { computeVoteConcordance } from "@/lib/data/compare";

export const dynamic = "force-dynamic";

const POLITICIAN_SELECT = {
  slug: true,
  firstName: true,
  lastName: true,
  fullName: true,
  photoUrl: true,
  currentParty: {
    select: { name: true, shortName: true, color: true },
  },
  votes: {
    take: 500,
    orderBy: { scrutin: { votingDate: "desc" as const } },
    select: {
      position: true,
      scrutinId: true,
      scrutin: {
        select: {
          id: true,
          title: true,
          slug: true,
          votingDate: true,
        },
      },
    },
  },
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slugA = searchParams.get("a");
  const slugB = searchParams.get("b");

  if (!slugA || !slugB) {
    return new Response("Missing ?a= and ?b= query parameters", {
      status: 400,
    });
  }

  const [polA, polB] = await Promise.all([
    db.politician.findUnique({ where: { slug: slugA }, select: POLITICIAN_SELECT }),
    db.politician.findUnique({ where: { slug: slugB }, select: POLITICIAN_SELECT }),
  ]);

  if (!polA || !polB) {
    return new Response("Politician not found", { status: 404 });
  }

  const { stats } = computeVoteConcordance(polA.votes, polB.votes);

  const colorA = polA.currentParty?.color || "#6366f1";
  const colorB = polB.currentParty?.color || "#6366f1";
  const partyA = polA.currentParty?.shortName || "";
  const partyB = polB.currentParty?.shortName || "";
  const initialsA = `${polA.firstName[0] || ""}${polA.lastName[0] || ""}`;
  const initialsB = `${polB.firstName[0] || ""}${polB.lastName[0] || ""}`;

  // Agreement bar percentages
  const agreePct = stats.total > 0 ? Math.round((stats.agree / stats.total) * 100) : 0;
  const partialPct = stats.total > 0 ? Math.round((stats.partial / stats.total) * 100) : 0;
  const disagreePct = stats.total > 0 ? 100 - agreePct - partialPct : 0;

  const img = new ImageResponse(
    <OgLayout>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
          gap: 28,
        }}
      >
        <OgCategoryLabel emoji="⚖️" label="Comparaison" />

        {/* Two politicians side by side */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
          }}
        >
          {/* Politician A */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
            }}
          >
            {polA.photoUrl ? (
              <img
                src={polA.photoUrl}
                width={130}
                height={130}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `4px solid ${colorA}`,
                  marginBottom: 12,
                }}
              />
            ) : (
              <div
                style={{
                  width: 130,
                  height: 130,
                  borderRadius: "50%",
                  background: colorA,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 42,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {initialsA}
              </div>
            )}
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "white",
                textAlign: "center",
                marginBottom: 6,
              }}
            >
              {polA.firstName} {polA.lastName.toUpperCase()}
            </div>
            {partyA && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: colorA,
                  }}
                />
                <span style={{ fontSize: 18, color: colorA }}>{partyA}</span>
              </div>
            )}
          </div>

          {/* VS */}
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: "#475569",
            }}
          >
            VS
          </div>

          {/* Politician B */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
            }}
          >
            {polB.photoUrl ? (
              <img
                src={polB.photoUrl}
                width={130}
                height={130}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `4px solid ${colorB}`,
                  marginBottom: 12,
                }}
              />
            ) : (
              <div
                style={{
                  width: 130,
                  height: 130,
                  borderRadius: "50%",
                  background: colorB,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 42,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {initialsB}
              </div>
            )}
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "white",
                textAlign: "center",
                marginBottom: 6,
              }}
            >
              {polB.firstName} {polB.lastName.toUpperCase()}
            </div>
            {partyB && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: colorB,
                  }}
                />
                <span style={{ fontSize: 18, color: colorB }}>{partyB}</span>
              </div>
            )}
          </div>
        </div>

        {/* Agreement bar + stats */}
        {stats.total > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                display: "flex",
                height: 32,
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              <div style={{ width: `${agreePct}%`, background: "#22c55e" }} />
              <div style={{ width: `${partialPct}%`, background: "#eab308" }} />
              <div style={{ width: `${disagreePct}%`, background: "#ef4444" }} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 32,
                fontSize: 20,
              }}
            >
              <span style={{ color: "#22c55e" }}>{agreePct}% accord</span>
              <span style={{ color: "#eab308" }}>{partialPct}% partiel</span>
              <span style={{ color: "#ef4444" }}>{disagreePct}% désaccord</span>
            </div>
            <div
              style={{
                fontSize: 16,
                color: "#64748b",
                textAlign: "center",
              }}
            >
              Sur {stats.total} votes en commun
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: 20,
              color: "#64748b",
              textAlign: "center",
            }}
          >
            Aucun vote en commun
          </div>
        )}
      </div>
    </OgLayout>,
    { ...OG_SIZE }
  );

  return new Response(await img.arrayBuffer(), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="poligraph-compare-${slugA}-vs-${slugB}.png"`,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
