import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { resolvePlanningSeason } from "@/lib/keeper/planning-season";

export const KEEPER_PRUNE_AUDIT_ACTION = "SYNC_REMOVE_KEEPER_PLAYER_LEFT_ROSTER";

export interface PrunableLeague {
  season: number;
  status: string | null | undefined;
}

/**
 * Which season's keeper rows on a roster are still PLANS that a roster change
 * can invalidate?
 *
 *  - PRE_DRAFT: plans for this season's draft (the draft hasn't consumed them)
 *  - IN_SEASON: plans for next season, made on this league's rosters
 *  - DRAFTING:  plans are being consumed right now — leave them alone
 *  - COMPLETE:  rosters are frozen; the plans were carried to the new league
 *
 * Historical keeper rows (the ones a draft actually used) are never in range:
 * for a PRE_DRAFT league the planning season IS the league season, and by the
 * time those rows become history the league is IN_SEASON and the range has
 * moved to season + 1.
 */
export function prunableKeeperSeason(league: PrunableLeague): number | null {
  if (league.status === "PRE_DRAFT" || league.status === "IN_SEASON") {
    return resolvePlanningSeason(league);
  }
  return null;
}

/**
 * Remove keeper plans for players who are no longer on the roster.
 *
 * A trade or drop on Sleeper moves the player, but the plan row the owner
 * made in the app stays behind: it still counts against their keeper and
 * franchise-tag limits, and the new owner's screens have no idea the player
 * was ever planned. Sleeper is the source of truth for who is on a roster,
 * so after each roster sync the plan rows for departed players are removed
 * and audit-logged (userId null = system action).
 *
 * Fail-safe: an empty player list is treated as a failed roster read, not an
 * empty roster, and nothing is pruned.
 */
export async function pruneKeepersForDepartedPlayers(params: {
  rosterId: string;
  league: PrunableLeague;
  /** DB Player ids currently on the roster (post-sync) */
  currentPlayerIds: string[];
}): Promise<{ removed: number }> {
  const season = prunableKeeperSeason(params.league);
  if (season === null || params.currentPlayerIds.length === 0) {
    return { removed: 0 };
  }

  const stale = await prisma.keeper.findMany({
    where: {
      rosterId: params.rosterId,
      season,
      playerId: { notIn: params.currentPlayerIds },
    },
    include: {
      player: { select: { sleeperId: true, fullName: true } },
      roster: { select: { teamName: true } },
    },
  });

  if (stale.length === 0) {
    return { removed: 0 };
  }

  await prisma.$transaction([
    prisma.auditLog.createMany({
      data: stale.map((k) => ({
        userId: null,
        action: KEEPER_PRUNE_AUDIT_ACTION,
        entity: "Keeper",
        entityId: k.id,
        oldValue: {
          rosterId: k.rosterId,
          rosterName: k.roster.teamName,
          playerId: k.playerId,
          playerSleeperId: k.player.sleeperId,
          playerName: k.player.fullName,
          season: k.season,
          type: k.type,
          baseCost: k.baseCost,
          finalCost: k.finalCost,
          yearsKept: k.yearsKept,
          acquisitionType: k.acquisitionType,
          isLocked: k.isLocked,
          notes: k.notes,
          reason: "Player no longer on this roster after Sleeper sync",
        },
      })),
    }),
    prisma.keeper.deleteMany({
      where: { id: { in: stale.map((k) => k.id) } },
    }),
  ]);

  logger.info("Removed keeper plans for players who left the roster", {
    rosterId: params.rosterId,
    season,
    removed: stale.length,
    players: stale.map((k) => k.player.fullName),
  });

  return { removed: stale.length };
}
