import { prisma } from "@/lib/prisma";
import { populateKeepersFromDraftPicks, recalculateKeeperYears } from "@/lib/sleeper/sync";
import { SyncContext, createSyncResponse, createSyncError } from "../types";

/**
 * Verify user has access to a league
 */
async function verifyLeagueAccess(leagueId: string, userId: string) {
  const roster = await prisma.roster.findFirst({
    where: {
      leagueId,
      teamMembers: {
        some: { userId },
      },
    },
  });
  return !!roster;
}

/**
 * Populate keeper records from historical draft picks with is_keeper=true
 */
export async function handlePopulateKeepers(
  context: SyncContext,
  body: Record<string, unknown>
) {
  const { leagueId } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required for populate-keepers", 400);
  }

  if (!(await verifyLeagueAccess(leagueId, context.userId))) {
    return createSyncError("You don't have access to this league", 403);
  }

  const result = await populateKeepersFromDraftPicks(leagueId);
  return createSyncResponse({
    success: true,
    message: `Created ${result.created} keeper records, skipped ${result.skipped} (already exist)`,
    data: result,
  });
}

/**
 * Recalculate yearsKept for all keepers in a league
 */
export async function handleRecalculateKeeperYears(
  context: SyncContext,
  body: Record<string, unknown>
) {
  const { leagueId } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required for recalculate-keeper-years", 400);
  }

  if (!(await verifyLeagueAccess(leagueId, context.userId))) {
    return createSyncError("You don't have access to this league", 403);
  }

  const result = await recalculateKeeperYears(leagueId);
  return createSyncResponse({
    success: true,
    message: `Updated ${result.updated} of ${result.total} keeper records`,
    data: result,
  });
}
