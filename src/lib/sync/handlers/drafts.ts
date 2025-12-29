import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";
import { SleeperDraftPick } from "@/lib/sleeper/types";
import { mapSleeperDraftStatus } from "@/lib/sleeper/mappers";
import { SyncContext, createSyncResponse, createSyncError } from "../types";

interface DraftSyncResult {
  sleeperLeagueId: string;
  season: string;
  picks: number;
  keepers: number;
}

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
 * Get roster and player maps for a league
 */
async function getMaps(leagueId: string, playerSleeperIds: string[]) {
  const rosters = await prisma.roster.findMany({
    where: { leagueId },
    select: { id: true, sleeperId: true },
  });
  const rosterMap = new Map(rosters.map((r) => [r.sleeperId, r.id]));

  const players = await prisma.player.findMany({
    where: { sleeperId: { in: playerSleeperIds } },
    select: { id: true, sleeperId: true },
  });
  const playerMap = new Map(players.map((p) => [p.sleeperId, p.id]));

  return { rosterMap, playerMap };
}

/**
 * Sync picks for a draft
 */
async function syncDraftPicks(
  draftId: string,
  picks: SleeperDraftPick[],
  rosterMap: Map<string, string>,
  playerMap: Map<string, string>
) {
  let totalPicks = 0;
  let keeperPicks = 0;

  for (const pick of picks) {
    const rosterId = rosterMap.get(String(pick.roster_id));
    if (!rosterId) continue;

    const playerId = pick.player_id ? playerMap.get(pick.player_id) || null : null;

    await prisma.draftPick.upsert({
      where: {
        draftId_round_draftSlot: {
          draftId,
          round: pick.round,
          draftSlot: pick.draft_slot,
        },
      },
      update: {
        rosterId,
        playerId,
        pickNumber: pick.pick_no,
        isKeeper: pick.is_keeper || false,
      },
      create: {
        draftId,
        rosterId,
        playerId,
        round: pick.round,
        pickNumber: pick.pick_no,
        draftSlot: pick.draft_slot,
        isKeeper: pick.is_keeper || false,
      },
    });

    totalPicks++;
    if (pick.is_keeper) keeperPicks++;
  }

  return { totalPicks, keeperPicks };
}

/**
 * Lightweight sync that only syncs drafts
 */
export async function handleSyncDraftsOnly(
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

    const drafts = await sleeper.getDrafts(league.sleeperId);
    let totalPicks = 0;
    let keeperPicks = 0;

    for (const draftData of drafts) {
      const picks = await sleeper.getDraftPicks(draftData.draft_id);

      // Upsert draft
      const draft = await prisma.draft.upsert({
        where: { sleeperId: draftData.draft_id },
        update: {
          status: mapSleeperDraftStatus(draftData.status),
        },
        create: {
          sleeperId: draftData.draft_id,
          leagueId,
          season: parseInt(draftData.season),
          type:
            draftData.type === "auction"
              ? "AUCTION"
              : draftData.type === "linear"
              ? "LINEAR"
              : "SNAKE",
          status: mapSleeperDraftStatus(draftData.status),
          rounds:
            typeof draftData.settings?.rounds === "number"
              ? draftData.settings.rounds
              : 16,
        },
      });

      const playerSleeperIds = picks.filter((p) => p.player_id).map((p) => p.player_id!);
      const { rosterMap, playerMap } = await getMaps(leagueId, playerSleeperIds);

      const result = await syncDraftPicks(draft.id, picks, rosterMap, playerMap);
      totalPicks += result.totalPicks;
      keeperPicks += result.keeperPicks;
    }

    return createSyncResponse({
      success: true,
      message: `Synced ${drafts.length} drafts, ${totalPicks} picks (${keeperPicks} keepers)`,
      data: { drafts: drafts.length, picks: totalPicks, keepers: keeperPicks },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "League not found") {
      return createSyncError("League not found", 404);
    }
    throw error;
  }
}

/**
 * Sync drafts from all historical seasons by following previous_league_id
 */
export async function handleSyncLeagueHistory(
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

    // Get roster map from current league
    const rosters = await prisma.roster.findMany({
      where: { leagueId },
      select: { id: true, sleeperId: true },
    });
    const rosterMap = new Map(rosters.map((r) => [r.sleeperId, r.id]));

    let totalDrafts = 0;
    let totalPicks = 0;
    let totalKeepers = 0;
    const results: DraftSyncResult[] = [];

    // Follow the previous_league_id chain
    let currentSleeperLeagueId: string | null = league.sleeperId;
    const maxSeasons = 5;
    let seasonsProcessed = 0;

    while (currentSleeperLeagueId && seasonsProcessed < maxSeasons) {
      try {
        const leagueData = await sleeper.getLeague(currentSleeperLeagueId);
        const drafts = await sleeper.getDrafts(currentSleeperLeagueId);

        for (const draftData of drafts) {
          const picks = await sleeper.getDraftPicks(draftData.draft_id);

          // Upsert draft
          const draft = await prisma.draft.upsert({
            where: { sleeperId: draftData.draft_id },
            update: {
              status: mapSleeperDraftStatus(draftData.status),
            },
            create: {
              sleeperId: draftData.draft_id,
              leagueId,
              season: parseInt(draftData.season),
              type:
                draftData.type === "auction"
                  ? "AUCTION"
                  : draftData.type === "linear"
                  ? "LINEAR"
                  : "SNAKE",
              status: mapSleeperDraftStatus(draftData.status),
              rounds:
                typeof draftData.settings?.rounds === "number"
                  ? draftData.settings.rounds
                  : 16,
            },
          });

          const playerSleeperIds = picks.filter((p) => p.player_id).map((p) => p.player_id!);
          const players = await prisma.player.findMany({
            where: { sleeperId: { in: playerSleeperIds } },
            select: { id: true, sleeperId: true },
          });
          const playerMap = new Map(players.map((p) => [p.sleeperId, p.id]));

          const result = await syncDraftPicks(draft.id, picks, rosterMap, playerMap);

          totalDrafts++;
          totalPicks += result.totalPicks;
          totalKeepers += result.keeperPicks;
          results.push({
            sleeperLeagueId: currentSleeperLeagueId,
            season: draftData.season,
            picks: result.totalPicks,
            keepers: result.keeperPicks,
          });
        }

        // Move to previous season
        currentSleeperLeagueId = leagueData.previous_league_id || null;
        seasonsProcessed++;
      } catch (err) {
        console.error(`Error syncing league ${currentSleeperLeagueId}:`, err);
        break;
      }
    }

    return createSyncResponse({
      success: true,
      message: `Synced ${totalDrafts} drafts from ${seasonsProcessed} seasons, ${totalPicks} picks (${totalKeepers} keepers)`,
      data: {
        drafts: totalDrafts,
        picks: totalPicks,
        keepers: totalKeepers,
        seasons: seasonsProcessed,
        results,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "League not found") {
      return createSyncError("League not found", 404);
    }
    throw error;
  }
}

/**
 * Sync drafts from multiple Sleeper league IDs (historical league chain)
 */
export async function handleSyncLeagueChain(
  context: SyncContext,
  body: Record<string, unknown>
) {
  const { leagueId, sleeperLeagueIds } = body;

  if (
    !leagueId ||
    typeof leagueId !== "string" ||
    !sleeperLeagueIds ||
    !Array.isArray(sleeperLeagueIds)
  ) {
    return createSyncError("leagueId and sleeperLeagueIds array are required", 400);
  }

  try {
    const league = await getLeagueOrError(leagueId);
    const sleeper = new SleeperClient();

    // Get roster map from current league
    const rosters = await prisma.roster.findMany({
      where: { leagueId },
      select: { id: true, sleeperId: true },
    });
    const rosterMap = new Map(rosters.map((r) => [r.sleeperId, r.id]));

    let totalDrafts = 0;
    let totalPicks = 0;
    let totalKeepers = 0;
    const results: DraftSyncResult[] = [];

    for (const sleeperLeagueId of sleeperLeagueIds as string[]) {
      try {
        const drafts = await sleeper.getDrafts(sleeperLeagueId);

        for (const draftData of drafts) {
          const picks = await sleeper.getDraftPicks(draftData.draft_id);

          // Upsert draft
          const draft = await prisma.draft.upsert({
            where: { sleeperId: draftData.draft_id },
            update: {
              status: mapSleeperDraftStatus(draftData.status),
            },
            create: {
              sleeperId: draftData.draft_id,
              leagueId,
              season: parseInt(draftData.season),
              type:
                draftData.type === "auction"
                  ? "AUCTION"
                  : draftData.type === "linear"
                  ? "LINEAR"
                  : "SNAKE",
              status: mapSleeperDraftStatus(draftData.status),
              rounds:
                typeof draftData.settings?.rounds === "number"
                  ? draftData.settings.rounds
                  : 16,
            },
          });

          const playerSleeperIds = picks.filter((p) => p.player_id).map((p) => p.player_id!);
          const players = await prisma.player.findMany({
            where: { sleeperId: { in: playerSleeperIds } },
            select: { id: true, sleeperId: true },
          });
          const playerMap = new Map(players.map((p) => [p.sleeperId, p.id]));

          const result = await syncDraftPicks(draft.id, picks, rosterMap, playerMap);

          totalDrafts++;
          totalPicks += result.totalPicks;
          totalKeepers += result.keeperPicks;
          results.push({
            sleeperLeagueId,
            season: draftData.season,
            picks: result.totalPicks,
            keepers: result.keeperPicks,
          });
        }
      } catch (err) {
        console.error(`Error syncing league ${sleeperLeagueId}:`, err);
        results.push({
          sleeperLeagueId,
          season: "error",
          picks: 0,
          keepers: 0,
        });
      }
    }

    return createSyncResponse({
      success: true,
      message: `Synced ${totalDrafts} drafts, ${totalPicks} picks (${totalKeepers} keepers)`,
      data: { drafts: totalDrafts, picks: totalPicks, keepers: totalKeepers, results },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "League not found") {
      return createSyncError("League not found", 404);
    }
    throw error;
  }
}
