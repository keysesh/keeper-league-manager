import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";
import { mapSleeperTradedPick } from "@/lib/sleeper/mappers";
import { SyncContext, createSyncResponse, createSyncError } from "../types";

/**
 * Get league and verify it exists
 */
async function getLeagueOrError(leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
  });

  if (!league) {
    throw new Error("League not found");
  }

  return league;
}

/**
 * Sync traded picks from Sleeper
 */
export async function handleSyncTradedPicks(
  context: SyncContext,
  body: Record<string, unknown>
) {
  const { leagueId } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required", 400);
  }

  try {
    const league = await getLeagueOrError(leagueId);
    const sleeper = new SleeperClient();

    const tradedPicks = await sleeper.getTradedPicks(league.sleeperId);

    // Get roster map for verification
    const rosters = await prisma.roster.findMany({
      where: { leagueId },
      select: { id: true, sleeperId: true, teamName: true },
    });
    const rosterMap = new Map(rosters.map((r) => [r.sleeperId, r]));

    let synced = 0;
    const details: Array<{
      season: number;
      round: number;
      originalOwner: string | null;
      currentOwner: string | null;
    }> = [];

    for (const pick of tradedPicks) {
      const mappedPick = mapSleeperTradedPick(pick);
      const originalRoster = rosterMap.get(mappedPick.originalOwnerId);
      const currentRoster = rosterMap.get(mappedPick.currentOwnerId);

      await prisma.tradedPick.upsert({
        where: {
          leagueId_season_round_originalOwnerId: {
            leagueId,
            season: mappedPick.season,
            round: mappedPick.round,
            originalOwnerId: mappedPick.originalOwnerId,
          },
        },
        update: {
          currentOwnerId: mappedPick.currentOwnerId,
        },
        create: {
          leagueId,
          ...mappedPick,
        },
      });

      synced++;
      details.push({
        season: mappedPick.season,
        round: mappedPick.round,
        originalOwner: originalRoster?.teamName || mappedPick.originalOwnerId,
        currentOwner: currentRoster?.teamName || mappedPick.currentOwnerId,
      });
    }

    return createSyncResponse({
      success: true,
      message: `Synced ${synced} traded picks`,
      data: {
        total: synced,
        details,
        rosters: rosters.map((r) => ({ sleeperId: r.sleeperId, teamName: r.teamName })),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "League not found") {
      return createSyncError("League not found", 404);
    }
    throw error;
  }
}
