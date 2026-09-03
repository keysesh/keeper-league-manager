import { prisma } from "@/lib/prisma";
import { populateKeepersFromDraftPicks, recalculateKeeperYears } from "@/lib/sleeper/sync";
import { getLeagueChain } from "@/lib/services/league-chain";
import { importKeeperLocks } from "@/lib/keeper/import-locks-apply";
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
 * Pull Sleeper's keeper slots into the plan.
 *
 * Managers who lock keepers in Sleeper and never open the app leave the plan
 * short, and the draft board then shows their picks as open. This closes that
 * gap in the one safe direction: it only adds, and it refuses anything the
 * league's own keeper limits would not allow.
 *
 * Commissioner-only, because it writes other managers' plans. Pass
 * `dryRun: true` to see what it would do.
 */
export async function handleImportKeeperLocks(
  context: SyncContext,
  body: Record<string, unknown>
) {
  const { leagueId, dryRun } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required for import-keeper-locks", 400);
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { commissionerId: true },
  });
  if (!league) {
    return createSyncError("League not found", 404);
  }
  if (league.commissionerId !== context.userId) {
    return createSyncError(
      "Only the commissioner can import keeper slots for the league",
      403
    );
  }

  const result = await importKeeperLocks(leagueId, { apply: dryRun !== true });

  const blocked = result.blocked.length
    ? `, ${result.blocked.length} refused by the league's keeper limits`
    : "";
  return createSyncResponse({
    success: true,
    message: dryRun === true
      ? `Would add ${result.created.length} keeper(s)${blocked}`
      : `Added ${result.created.length} keeper(s)${blocked}`,
    data: result,
  });
}

/**
 * Populate keeper records from historical draft picks with is_keeper=true
 * Now supports populating across the entire league chain (all historical seasons)
 */
export async function handlePopulateKeepers(
  context: SyncContext,
  body: Record<string, unknown>
) {
  const { leagueId, includeHistory = true } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required for populate-keepers", 400);
  }

  if (!(await verifyLeagueAccess(leagueId, context.userId))) {
    return createSyncError("You don't have access to this league", 403);
  }

  // Get all leagues in the chain if includeHistory is true
  const leagueIds = includeHistory ? await getLeagueChain(leagueId) : [leagueId];

  let totalCreated = 0;
  let totalSkipped = 0;
  const results: Array<{ leagueId: string; created: number; skipped: number }> = [];

  // Populate keepers for each league in the chain (oldest first for correct yearsKept)
  for (const id of leagueIds.reverse()) {
    const result = await populateKeepersFromDraftPicks(id);
    totalCreated += result.created;
    totalSkipped += result.skipped;
    results.push({ leagueId: id, ...result });
  }

  return createSyncResponse({
    success: true,
    message: `Created ${totalCreated} keeper records across ${leagueIds.length} season(s), skipped ${totalSkipped} (already exist)`,
    data: {
      totalCreated,
      totalSkipped,
      seasonsProcessed: leagueIds.length,
      details: results,
    },
  });
}

/**
 * Recalculate yearsKept for all keepers in a league
 * Now supports recalculating across the entire league chain
 */
export async function handleRecalculateKeeperYears(
  context: SyncContext,
  body: Record<string, unknown>
) {
  const { leagueId, includeHistory = true } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required for recalculate-keeper-years", 400);
  }

  if (!(await verifyLeagueAccess(leagueId, context.userId))) {
    return createSyncError("You don't have access to this league", 403);
  }

  // Get all leagues in the chain if includeHistory is true
  const leagueIds = includeHistory ? await getLeagueChain(leagueId) : [leagueId];

  let totalUpdated = 0;
  let totalRecords = 0;
  const results: Array<{ leagueId: string; updated: number; total: number }> = [];

  // Recalculate for each league (oldest first)
  for (const id of leagueIds.reverse()) {
    const result = await recalculateKeeperYears(id);
    totalUpdated += result.updated;
    totalRecords += result.total;
    results.push({ leagueId: id, ...result });
  }

  return createSyncResponse({
    success: true,
    message: `Updated ${totalUpdated} of ${totalRecords} keeper records across ${leagueIds.length} season(s)`,
    data: {
      totalUpdated,
      totalRecords,
      seasonsProcessed: leagueIds.length,
      details: results,
    },
  });
}
