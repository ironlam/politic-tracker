import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { getDepartmentBySlug } from "@/config/departments";
import { OgLayout, OgCategoryLabel, OG_SIZE } from "@/lib/og-utils";

export const alt = "Département sur Poligraph";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dept = getDepartmentBySlug(slug);

  if (!dept) {
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
          Département non trouvé
        </div>
      </OgLayout>,
      { ...OG_SIZE }
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
    <OgLayout>
      <OgCategoryLabel emoji="📍" label="Département" />

      {/* Department code */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 120,
          height: 120,
          borderRadius: 20,
          background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
          marginBottom: 28,
          fontSize: 56,
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
          fontSize: 44,
          fontWeight: 700,
          color: "white",
          marginBottom: 12,
        }}
      >
        {dept.name}
      </div>

      {/* Region */}
      <div style={{ fontSize: 24, color: "#94a3b8", marginBottom: 28 }}>{dept.region}</div>

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
    </OgLayout>,
    { ...OG_SIZE }
  );
}
