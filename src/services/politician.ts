/**
 * Politician Service
 *
 * Centralized service for managing politician data, especially party affiliations.
 * This ensures consistency between `currentPartyId` and `PartyMembership`.
 *
 * IMPORTANT: Always use this service to change party affiliations.
 * Never update `currentPartyId` directly.
 */

import { db } from "@/lib/db";

export interface SetPartyOptions {
  /** Start date of the new affiliation (defaults to now) */
  startDate?: Date;
  /** End the previous membership (defaults to true) */
  endPreviousMembership?: boolean;
}

/**
 * Set the current party for a politician.
 *
 * This function:
 * 1. Ends the current party membership (if any)
 * 2. Creates a new party membership
 * 3. Updates the politician's currentPartyId
 *
 * @example
 * await politicianService.setCurrentParty("politician-id", "party-id");
 * await politicianService.setCurrentParty("politician-id", null); // Remove party
 */
export async function setCurrentParty(
  politicianId: string,
  partyId: string | null,
  options: SetPartyOptions = {}
): Promise<void> {
  const { startDate = new Date(), endPreviousMembership = true } = options;

  await db.$transaction(async (tx) => {
    // 1. Get current party membership
    const currentMembership = await tx.partyMembership.findFirst({
      where: {
        politicianId,
        endDate: null,
      },
      orderBy: { startDate: "desc" },
    });

    // 2. End current membership if different party
    if (
      endPreviousMembership &&
      currentMembership &&
      currentMembership.partyId !== partyId
    ) {
      await tx.partyMembership.update({
        where: { id: currentMembership.id },
        data: { endDate: startDate },
      });
    }

    // 3. Create new membership if party is set and different
    if (partyId && (!currentMembership || currentMembership.partyId !== partyId)) {
      await tx.partyMembership.create({
        data: {
          politicianId,
          partyId,
          startDate,
        },
      });
    }

    // 4. Update currentPartyId
    await tx.politician.update({
      where: { id: politicianId },
      data: { currentPartyId: partyId },
    });
  });
}

/**
 * Remove party affiliation from a politician.
 *
 * This ends the current membership and sets currentPartyId to null.
 */
export async function removeParty(
  politicianId: string,
  endDate: Date = new Date()
): Promise<void> {
  await db.$transaction(async (tx) => {
    // End current membership
    await tx.partyMembership.updateMany({
      where: {
        politicianId,
        endDate: null,
      },
      data: { endDate },
    });

    // Clear currentPartyId
    await tx.politician.update({
      where: { id: politicianId },
      data: { currentPartyId: null },
    });
  });
}

/**
 * Sync currentPartyId from PartyMembership for all politicians.
 *
 * Use this to fix inconsistencies between the two.
 * The current party is determined by the membership with no endDate
 * (or the most recent one if multiple exist).
 */
export async function syncAllCurrentParties(): Promise<{
  updated: number;
  errors: string[];
}> {
  const politicians = await db.politician.findMany({
    select: {
      id: true,
      currentPartyId: true,
      partyHistory: {
        where: { endDate: null },
        orderBy: { startDate: "desc" },
        take: 1,
        select: { partyId: true },
      },
    },
  });

  let updated = 0;
  const errors: string[] = [];

  for (const p of politicians) {
    const expectedPartyId = p.partyHistory[0]?.partyId ?? null;

    if (p.currentPartyId !== expectedPartyId) {
      try {
        await db.politician.update({
          where: { id: p.id },
          data: { currentPartyId: expectedPartyId },
        });
        updated++;
      } catch (error) {
        errors.push(`Failed to update ${p.id}: ${error}`);
      }
    }
  }

  return { updated, errors };
}

/**
 * Audit party consistency for all politicians.
 *
 * Returns a list of politicians where currentPartyId doesn't match
 * the current PartyMembership.
 */
export async function auditPartyConsistency(): Promise<
  Array<{
    politicianId: string;
    fullName: string;
    currentPartyId: string | null;
    expectedPartyId: string | null;
    currentPartyName: string | null;
    expectedPartyName: string | null;
  }>
> {
  const politicians = await db.politician.findMany({
    select: {
      id: true,
      fullName: true,
      currentPartyId: true,
      currentParty: { select: { shortName: true } },
      partyHistory: {
        where: { endDate: null },
        orderBy: { startDate: "desc" },
        take: 1,
        select: {
          partyId: true,
          party: { select: { shortName: true } },
        },
      },
    },
  });

  const inconsistencies = [];

  for (const p of politicians) {
    const expectedPartyId = p.partyHistory[0]?.partyId ?? null;

    if (p.currentPartyId !== expectedPartyId) {
      inconsistencies.push({
        politicianId: p.id,
        fullName: p.fullName,
        currentPartyId: p.currentPartyId,
        expectedPartyId,
        currentPartyName: p.currentParty?.shortName ?? null,
        expectedPartyName: p.partyHistory[0]?.party.shortName ?? null,
      });
    }
  }

  return inconsistencies;
}

/**
 * Get party history for a politician.
 */
export async function getPartyHistory(politicianId: string) {
  return db.partyMembership.findMany({
    where: { politicianId },
    orderBy: { startDate: "desc" },
    include: {
      party: {
        select: {
          id: true,
          name: true,
          shortName: true,
          color: true,
        },
      },
    },
  });
}

export const politicianService = {
  setCurrentParty,
  removeParty,
  syncAllCurrentParties,
  auditPartyConsistency,
  getPartyHistory,
};
