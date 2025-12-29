import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";
import { SyncContext, createSyncError } from "../types";

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
 * Debug: Show all keeper records and draft picks with isKeeper flag
 */
export async function handleDebugKeepers(
  context: SyncContext,
  body: Record<string, unknown>
) {
  const { leagueId } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required", 400);
  }

  const keepers = await prisma.keeper.findMany({
    where: { roster: { leagueId } },
    include: { player: true, roster: true },
    orderBy: [{ season: "asc" }, { roster: { teamName: "asc" } }],
  });

  const keeperDraftPicks = await prisma.draftPick.findMany({
    where: {
      isKeeper: true,
      draft: { league: { id: leagueId } },
    },
    include: { player: true, roster: true, draft: true },
    orderBy: [{ draft: { season: "asc" } }],
  });

  return NextResponse.json({
    keeperRecords: keepers.map((k) => ({
      id: k.id,
      playerName: k.player?.fullName,
      rosterId: k.rosterId,
      rosterName: k.roster?.teamName,
      season: k.season,
      yearsKept: k.yearsKept,
      baseCost: k.baseCost,
      finalCost: k.finalCost,
    })),
    draftPicksMarkedAsKeeper: keeperDraftPicks.map((p) => ({
      playerName: p.player?.fullName,
      rosterId: p.rosterId,
      rosterName: p.roster?.teamName,
      season: p.draft.season,
      round: p.round,
      isKeeper: p.isKeeper,
    })),
    summary: {
      totalKeeperRecords: keepers.length,
      totalKeeperDraftPicks: keeperDraftPicks.length,
    },
  });
}

/**
 * Check Sleeper API directly for keeper data
 */
export async function handleCheckSleeperKeepers(
  context: SyncContext,
  body: Record<string, unknown>
) {
  const { sleeperLeagueId } = body;

  if (!sleeperLeagueId || typeof sleeperLeagueId !== "string") {
    return createSyncError("sleeperLeagueId is required", 400);
  }

  const sleeper = new SleeperClient();

  const drafts = await sleeper.getDrafts(sleeperLeagueId);
  const allKeeperPicks = [];

  for (const draft of drafts) {
    const picks = await sleeper.getDraftPicks(draft.draft_id);
    const keeperPicks = picks.filter((p) => p.is_keeper === true);
    allKeeperPicks.push({
      draftId: draft.draft_id,
      season: draft.season,
      totalPicks: picks.length,
      keeperPicks: keeperPicks.map((p) => ({
        player_id: p.player_id,
        round: p.round,
        pick_no: p.pick_no,
        is_keeper: p.is_keeper,
        metadata: p.metadata,
      })),
    });
  }

  return NextResponse.json({
    sleeperLeagueId,
    drafts: drafts.map((d) => ({ id: d.draft_id, season: d.season, status: d.status })),
    keeperData: allKeeperPicks,
  });
}

/**
 * Debug: Show all traded picks from both Sleeper and DB
 */
export async function handleDebugTradedPicks(
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

    // Get from Sleeper
    const sleeperPicks = await sleeper.getTradedPicks(league.sleeperId);

    // Get from DB
    const dbPicks = await prisma.tradedPick.findMany({
      where: { leagueId },
      orderBy: [{ season: "asc" }, { round: "asc" }],
    });

    // Get roster map
    const rosters = await prisma.roster.findMany({
      where: { leagueId },
      select: { id: true, sleeperId: true, teamName: true },
    });
    const rosterMap = new Map(rosters.map((r) => [r.sleeperId, r.teamName]));

    return NextResponse.json({
      sleeperPicks: sleeperPicks.map((p) => ({
        season: p.season,
        round: p.round,
        originalOwner: rosterMap.get(String(p.owner_id)) || String(p.owner_id),
        currentOwner: rosterMap.get(String(p.roster_id)) || String(p.roster_id),
        raw: {
          owner_id: p.owner_id,
          roster_id: p.roster_id,
          previous_owner_id: p.previous_owner_id,
        },
      })),
      dbPicks: dbPicks.map((p) => ({
        season: p.season,
        round: p.round,
        originalOwner: rosterMap.get(p.originalOwnerId) || p.originalOwnerId,
        currentOwner: rosterMap.get(p.currentOwnerId) || p.currentOwnerId,
      })),
      rosters: rosters.map((r) => ({ sleeperId: r.sleeperId, teamName: r.teamName })),
      summary: {
        sleeperCount: sleeperPicks.length,
        dbCount: dbPicks.length,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "League not found") {
      return createSyncError("League not found", 404);
    }
    throw error;
  }
}
