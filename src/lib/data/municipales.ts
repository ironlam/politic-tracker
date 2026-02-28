import { cache } from "react";
import { db } from "@/lib/db";

export const getCommune = cache(async function getCommune(inseeCode: string) {
  // Get commune
  const commune = await db.commune.findUnique({
    where: { id: inseeCode },
  });

  if (!commune) return null;

  // Get election for municipales 2026 (sequential to respect pool limit of 2)
  const election = await db.election.findUnique({
    where: { slug: "municipales-2026" },
    select: { id: true, round1Date: true },
  });

  if (!election) {
    return {
      ...commune,
      electionId: null,
      round1Date: null,
      lists: [],
      stats: {
        listCount: 0,
        candidateCount: 0,
        femaleRate: 0,
        nationalPoliticiansCount: 0,
      },
    };
  }

  // Get all candidacies for this commune in this election, with candidate + politician data
  const candidacies = await db.candidacy.findMany({
    where: { electionId: election.id, communeId: inseeCode },
    include: {
      candidate: true,
      politician: {
        select: {
          id: true,
          slug: true,
          fullName: true,
          photoUrl: true,
          currentParty: { select: { shortName: true, color: true } },
          mandates: {
            where: { isCurrent: true },
            select: { type: true },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ listName: "asc" }, { listPosition: "asc" }],
  });

  // After candidacies fetch, load participation stats for linked politicians
  const politicianIds = candidacies
    .filter((c) => c.politicianId != null)
    .map((c) => c.politicianId!);

  const participationMap = new Map<string, number>();
  const affairsCountMap = new Map<string, number>();

  if (politicianIds.length > 0) {
    const participations = await db.politicianParticipation.findMany({
      where: { politicianId: { in: politicianIds } },
      select: { politicianId: true, participationRate: true },
    });
    for (const p of participations) {
      participationMap.set(p.politicianId, p.participationRate);
    }

    // Count affairs per politician
    const affairsCounts = await db.affair.groupBy({
      by: ["politicianId"],
      where: { politicianId: { in: politicianIds } },
      _count: true,
    });
    for (const a of affairsCounts) {
      affairsCountMap.set(a.politicianId, a._count);
    }
  }

  // Group candidacies by list
  type EnrichedCandidacy = (typeof candidacies)[number] & {
    participationRate?: number | null;
    affairsCount?: number;
  };

  const listsMap = new Map<string, EnrichedCandidacy[]>();
  for (const c of candidacies) {
    const key = c.listName || "Sans liste";
    const list = listsMap.get(key) || [];
    const enriched: EnrichedCandidacy = {
      ...c,
      participationRate: c.politicianId ? (participationMap.get(c.politicianId) ?? null) : null,
      affairsCount: c.politicianId ? (affairsCountMap.get(c.politicianId) ?? 0) : 0,
    };
    list.push(enriched);
    listsMap.set(key, list);
  }

  const lists = Array.from(listsMap.entries()).map(([name, members]) => ({
    name,
    partyLabel: members[0]?.partyLabel || null,
    candidateCount: members.length,
    femaleCount: members.filter((m) => m.candidate?.gender === "F").length,
    teteDeListe: members.find((m) => m.listPosition === 1) || members[0],
    members,
  }));

  const totalCandidates = candidacies.length;
  const femaleCount = candidacies.filter((c) => c.candidate?.gender === "F").length;
  const femaleRate = totalCandidates > 0 ? femaleCount / totalCandidates : 0;
  const nationalPoliticiansCount = candidacies.filter((c) => c.politicianId != null).length;

  return {
    ...commune,
    electionId: election.id,
    round1Date: election.round1Date,
    lists,
    stats: {
      listCount: lists.length,
      candidateCount: totalCandidates,
      femaleRate,
      nationalPoliticiansCount,
    },
  };
});
