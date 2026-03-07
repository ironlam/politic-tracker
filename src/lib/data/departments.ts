import { db } from "@/lib/db";

// ============================================
// Department representatives data functions
// ============================================

export async function getDeputiesByDepartment(departmentName: string) {
  return db.politician.findMany({
    where: {
      mandates: {
        some: {
          type: "DEPUTE",
          isCurrent: true,
          constituency: {
            startsWith: departmentName,
            mode: "insensitive",
          },
        },
      },
    },
    include: {
      currentParty: true,
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
    orderBy: { lastName: "asc" },
  });
}

export async function getSenatorsByDepartment(departmentName: string) {
  return db.politician.findMany({
    where: {
      mandates: {
        some: {
          type: "SENATEUR",
          isCurrent: true,
          constituency: {
            contains: departmentName,
            mode: "insensitive",
          },
        },
      },
    },
    include: {
      currentParty: true,
      mandates: {
        where: {
          type: "SENATEUR",
          isCurrent: true,
        },
        select: {
          constituency: true,
        },
        take: 1,
      },
    },
    orderBy: { lastName: "asc" },
  });
}
