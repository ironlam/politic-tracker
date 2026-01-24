import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const department = searchParams.get("department");

  if (!department) {
    return NextResponse.json(
      { error: "Le paramètre 'department' est requis" },
      { status: 400 }
    );
  }

  try {
    // Find deputies with current mandate in this department
    // Use startsWith to avoid matching "Bouches-du-Rhône" when searching for "Rhône"
    const deputies = await db.politician.findMany({
      where: {
        mandates: {
          some: {
            type: "DEPUTE",
            isCurrent: true,
            constituency: {
              startsWith: department,
              mode: "insensitive",
            },
          },
        },
      },
      include: {
        currentParty: {
          select: {
            shortName: true,
            color: true,
          },
        },
        mandates: {
          where: {
            type: "DEPUTE",
            isCurrent: true,
          },
          select: {
            constituency: true,
          },
          take: 1,
        },
      },
      orderBy: [
        // Order by constituency number (extract number from "Département (X)")
        { lastName: "asc" },
      ],
    });

    // Format response
    const result = deputies.map((deputy) => ({
      id: deputy.id,
      slug: deputy.slug,
      fullName: deputy.fullName,
      photoUrl: deputy.photoUrl,
      constituency: deputy.mandates[0]?.constituency || null,
      party: deputy.currentParty
        ? {
            shortName: deputy.currentParty.shortName,
            color: deputy.currentParty.color,
          }
        : null,
    }));

    // Sort by constituency number
    result.sort((a, b) => {
      const numA = a.constituency?.match(/\((\d+)\)/)?.[1];
      const numB = b.constituency?.match(/\((\d+)\)/)?.[1];
      if (numA && numB) {
        return parseInt(numA) - parseInt(numB);
      }
      return 0;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching deputies:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recherche des députés" },
      { status: 500 }
    );
  }
}
