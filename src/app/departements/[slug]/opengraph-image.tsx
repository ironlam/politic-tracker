import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getDepartmentBySlug } from "@/config/departments";

export const alt = "Département sur Poligraph";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dept = getDepartmentBySlug(slug);

  if (!dept) {
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
        Département non trouvé
      </div>,
      { ...size }
    );
  }

  // Count deputies and senators for this department
  const [deputyCount, senatorCount] = await Promise.all([
    db.politician.count({
      where: {
        mandates: {
          some: {
            type: "DEPUTE",
            isCurrent: true,
            constituency: { startsWith: dept.name, mode: "insensitive" },
          },
        },
      },
    }),
    db.politician.count({
      where: {
        mandates: {
          some: {
            type: "SENATEUR",
            isCurrent: true,
            constituency: { startsWith: dept.name, mode: "insensitive" },
          },
        },
      },
    }),
  ]);

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
      {/* Department code */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 100,
          height: 100,
          borderRadius: 20,
          background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
          marginBottom: 32,
          fontSize: 40,
          fontWeight: 700,
          color: "white",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
        }}
      >
        {dept.code}
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: "white",
          marginBottom: 12,
        }}
      >
        {dept.name}
      </div>

      {/* Region */}
      <div style={{ fontSize: 26, color: "#94a3b8", marginBottom: 32 }}>{dept.region}</div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 40, fontSize: 22, color: "#94a3b8" }}>
        {deputyCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 26 }}>🏛️</span>
            <span>
              {deputyCount} député{deputyCount > 1 ? "s" : ""}
            </span>
          </div>
        )}
        {senatorCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 26 }}>🏛️</span>
            <span>
              {senatorCount} sénateur{senatorCount > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ fontSize: 20, color: "#475569", marginTop: "auto" }}>poligraph.fr</div>
    </div>,
    { ...size }
  );
}
