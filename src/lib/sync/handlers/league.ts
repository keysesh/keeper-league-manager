import { prisma } from "@/lib/prisma";
import { syncLeague, syncUserLeagues, quickSyncLeague } from "@/lib/sleeper/sync";
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
