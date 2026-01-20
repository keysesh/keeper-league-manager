import { prisma } from "@/lib/prisma";
import { syncLeague, syncUserLeagues, quickSyncLeague, syncLeagueWithHistory, populateKeepersFromDraftPicks } from "@/lib/sleeper/sync";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";
import { SyncContext, createSyncResponse, createSyncError } from "../types";

/**
 * Sync a specific league by Sleeper ID
 */
export async function handleLeagueSync(
  context: SyncContext,
  body: Record<string, unknown>
) {
  const { sleeperLeagueId } = body;

  if (!sleeperLeagueId || typeof sleeperLeagueId !== "string") {
    return createSyncError("sleeperLeagueId is required", 400);
  }

  const result = await syncLeague(sleeperLeagueId);
  return createSyncResponse({
    success: true,
    message: `Synced league: ${result.league.name}`,
    data: result,
  });
}

/**
 * Sync all leagues for the current user
 */
export async function handleUserLeaguesSync(context: SyncContext) {
  const season = getCurrentSeason();
  const result = await syncUserLeagues(context.userId, season);

  return createSyncResponse({
    success: true,
    message: `Synced ${result.leagues.length} leagues`,
    data: result,
  });
}

/**
 * Quick sync - just update rosters for a league
 */
export async function handleQuickSync(
  context: SyncContext,
  body: Record<string, unknown>
) {
  const { leagueId } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required for quick sync", 400);
  }

  // Verify user has access to this league
  const roster = await prisma.roster.findFirst({
    where: {
      leagueId,
      teamMembers: {
        some: { userId: context.userId },
      },
    },
  });

  if (!roster) {
    return createSyncError("You don't have access to this league", 403);
  }

  const result = await quickSyncLeague(leagueId);
  return createSyncResponse({
    success: true,
    message: "Quick sync complete",
    data: result,
  });
}

/**
 * Full sync - syncs current league + all historical seasons, transactions, and keepers
 * This is the comprehensive "sync everything" option
 */
export async function handleFullSync(
  context: SyncContext,
  body: Record<string, unknown>
) {
  const { leagueId } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required for full sync", 400);
  }

  // Verify user has access to this league
  const league = await prisma.league.findFirst({
    where: {
      id: leagueId,
      rosters: {
        some: {
          teamMembers: {
            some: { userId: context.userId },
          },
        },
      },
    },
    select: { id: true, sleeperId: true, name: true },
  });

  if (!league) {
    return createSyncError("You don't have access to this league", 403);
  }

  // Sync all historical seasons (this includes rosters, drafts, traded picks)
  // Limit to 5 seasons to avoid timeout - user can run again for more history
  const historyResult = await syncLeagueWithHistory(league.sleeperId, 5);

  // Populate keepers for all synced seasons
  let totalKeepers = 0;
  for (const season of historyResult.seasons) {
    try {
      const keeperResult = await populateKeepersFromDraftPicks(season.leagueId);
      totalKeepers += keeperResult.created;
    } catch (err) {
      // Continue even if one season fails
      console.warn(`Failed to populate keepers for ${season.season}:`, err);
    }
  }

  return createSyncResponse({
    success: true,
    message: `Full sync complete: ${historyResult.seasons.length} seasons, ${historyResult.totalTransactions} transactions, ${totalKeepers} keepers`,
    data: {
      seasons: historyResult.seasons,
      totalTransactions: historyResult.totalTransactions,
      totalKeepers,
    },
  });
}
