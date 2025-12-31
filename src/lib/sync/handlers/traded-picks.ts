import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";
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

    // Fetch traded picks and rosters from Sleeper API
    const [tradedPicks, sleeperRosters] = await Promise.all([
      sleeper.getTradedPicks(league.sleeperId),
      sleeper.getRosters(league.sleeperId),
    ]);

    // Build a map from Sleeper roster_id (slot 1-10) to owner_id (Sleeper user ID)
    // This is needed because traded picks use roster slot numbers, not user IDs
    const slotToOwnerMap = new Map<number, string>();
    for (const roster of sleeperRosters) {
      if (roster.owner_id) {
        slotToOwnerMap.set(roster.roster_id, roster.owner_id);
      }
    }

    // Get DB rosters for team names
    const dbRosters = await prisma.roster.findMany({
      where: { leagueId },
      select: { id: true, sleeperId: true, teamName: true },
    });
    const rosterMap = new Map(dbRosters.map((r) => [r.sleeperId, r]));

    let synced = 0;
    const details: Array<{
      season: number;
      round: number;
      originalOwner: string | null;
      currentOwner: string | null;
    }> = [];

    for (const pick of tradedPicks) {
      // Convert slot numbers to Sleeper user IDs
      // pick.owner_id = original owner's roster slot (1-10)
      // pick.roster_id = current owner's roster slot (1-10)
      const originalOwnerId = slotToOwnerMap.get(pick.owner_id);
      const currentOwnerId = slotToOwnerMap.get(pick.roster_id);

      // Skip if we can't map to valid user IDs
      if (!originalOwnerId || !currentOwnerId) {
        context.logger?.warn("Could not map roster slot to owner ID", {
          pick,
          originalOwnerId,
          currentOwnerId,
        });
        continue;
      }

      const mappedPick = {
        season: parseInt(pick.season),
        round: pick.round,
        originalOwnerId,
        currentOwnerId,
      };

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
        rosters: dbRosters.map((r) => ({ sleeperId: r.sleeperId, teamName: r.teamName })),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "League not found") {
      return createSyncError("League not found", 404);
    }
    throw error;
  }
}
