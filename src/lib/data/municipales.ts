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

  // Group candidacies by list
  const listsMap = new Map<string, typeof candidacies>();
  for (const c of candidacies) {
    const key = c.listName || "Sans liste";
    const list = listsMap.get(key) || [];
    list.push(c);
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
