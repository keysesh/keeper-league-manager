import { DraftStatus, KeeperSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { batchComputeKeeperCosts } from "./cost";
import { recalculateAndApplyCascade } from "./cascade";

/**
 * Re-derive stored Keeper.baseCost for a league from the cost engine.
 *
 * Keeper.baseCost is written once, when a keeper is saved, and never
 * recomputed afterwards: recalculateAndApplyCascade only ever rewrites
 * finalCost. So anything that changes what a keeper COSTS — a trade, a waiver
 * claim, a rebuilt acquisition chain, a correction to the engine — updates the
 * derivation while leaving every already-saved row showing its old price,
 * until someone happens to re-save that keeper by hand.
 *
 * Delegates to the engine rather than restating the formula, so it cannot
 * drift from it the way the older recalculate-keeper-costs paths did.
 */

export interface BaseCostChange {
  keeperId: string;
  playerName: string;
  teamName: string | null;
  from: number;
  to: number;
  breakdown: string;
}

export interface ResyncResult {
  leagueId: string;
  season: number;
  /** Set when the season was left alone, with the reason. */
  skipped?: "draft-complete" | "no-keepers";
  changes: BaseCostChange[];
  /** How many rows were actually written (0 in dry-run mode). */
  written: number;
  cascadeErrors: string[];
}

export interface ResyncOptions {
  /** Write the corrected costs. When false, only report what would change. */
  apply?: boolean;
  /**
   * Rewrite a season whose draft has already completed. Off by default:
   * those rows are the record of what was actually drafted, not stale
   * values, and round-trip verification compares them against Sleeper's
   * real board — re-pricing them retroactively turns that into fiction.
   */
  allowCompletedDraft?: boolean;
}

export async function resyncKeeperBaseCosts(
  leagueId: string,
  season: number,
  options: ResyncOptions = {}
): Promise<ResyncResult> {
  const { apply = false, allowCompletedDraft = false } = options;
  const base: ResyncResult = {
    leagueId,
    season,
    changes: [],
    written: 0,
    cascadeErrors: [],
  };

  const keepers = await prisma.keeper.findMany({
    where: { season, roster: { leagueId } },
    select: {
      id: true,
      playerId: true,
      baseCost: true,
      player: { select: { fullName: true } },
      roster: { select: { sleeperId: true, teamName: true } },
    },
  });

  if (keepers.length === 0) {
    return { ...base, skipped: "no-keepers" };
  }

  const settings: KeeperSettings | null = await prisma.keeperSettings.findFirst({
    where: { leagueId },
  });

  // The engine batches per owner, so group before asking.
  const byOwner = new Map<string, typeof keepers>();
  for (const k of keepers) {
    if (!k.roster.sleeperId) continue;
    const list = byOwner.get(k.roster.sleeperId);
    if (list) list.push(k);
    else byOwner.set(k.roster.sleeperId, [k]);
  }

  const changes: BaseCostChange[] = [];
  for (const [ownerSleeperId, ownerKeepers] of byOwner) {
    const costs = await batchComputeKeeperCosts(
      ownerKeepers.map((k) => k.playerId),
      ownerSleeperId,
      season,
      settings
    );

    for (const k of ownerKeepers) {
      const cost = costs.get(k.playerId);
      if (!cost || cost.effectiveCost === k.baseCost) continue;
      changes.push({
        keeperId: k.id,
        playerName: k.player.fullName,
        teamName: k.roster.teamName,
        from: k.baseCost,
        to: cost.effectiveCost,
        breakdown: cost.costBreakdown,
      });
    }
  }

  // The guard blocks the WRITE, not the analysis: seeing how today's rules
  // would price a finished season is a useful diagnostic, and the caller still
  // gets the list. It just never lands in the database.
  if (!allowCompletedDraft) {
    const completedDraft = await prisma.draft.findFirst({
      where: { leagueId, season, status: DraftStatus.COMPLETE },
      select: { id: true },
    });
    if (completedDraft) {
      return { ...base, changes, skipped: "draft-complete" };
    }
  }

  if (!apply || changes.length === 0) {
    return { ...base, changes };
  }

  for (const change of changes) {
    await prisma.keeper.update({
      where: { id: change.keeperId },
      data: { baseCost: change.to },
    });
  }

  // Slots are derived from the prices that just moved, so they have to follow.
  const cascade = await recalculateAndApplyCascade(leagueId, season);

  return {
    ...base,
    changes,
    written: changes.length,
    cascadeErrors: cascade.errors,
  };
}
