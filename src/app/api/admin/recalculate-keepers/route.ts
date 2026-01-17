import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isTradeAfterDeadline, DEFAULT_KEEPER_RULES } from "@/lib/constants/keeper-rules";
import {
  checkRateLimit,
  createRateLimitResponse,
  addRateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/rate-limit";

function getSeasonFromDate(date: Date): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month < 2) return year - 1;
  return year;
}

async function getOriginSeasonForOwner(
  playerId: string,
  targetSleeperId: string,
  targetSeason: number,
  rosterToSleeperMap: Map<string, string>,
  visited: Set<string>
): Promise<{ originSeason: number; draftRound?: number }> {
  const key = `${playerId}-${targetSleeperId}`;
  if (visited.has(key)) {
    return { originSeason: targetSeason };
  }
  visited.add(key);

  // Check if drafted by this owner
  const draftPick = await prisma.draftPick.findFirst({
    where: {
      playerId,
      roster: { sleeperId: targetSleeperId },
    },
    include: { draft: true },
    orderBy: { draft: { season: "asc" } },
  });

  if (draftPick) {
    return { originSeason: draftPick.draft.season, draftRound: draftPick.round };
  }

  // Find acquisition transaction
  const targetRosters = await prisma.roster.findMany({
    where: { sleeperId: targetSleeperId },
    select: { id: true },
  });
  const targetRosterIds = targetRosters.map(r => r.id);

  const transaction = await prisma.transactionPlayer.findFirst({
    where: {
      playerId,
      toRosterId: { in: targetRosterIds },
    },
    include: { transaction: true },
    orderBy: { transaction: { createdAt: "desc" } },
  });

  if (!transaction) {
    return { originSeason: targetSeason };
  }

  const txDate = transaction.transaction.createdAt;
  const txType = transaction.transaction.type;
  const txSeason = getSeasonFromDate(txDate);

  // Handle trades
  if (txType === "TRADE" && transaction.fromRosterId) {
    const fromSleeperId = rosterToSleeperMap.get(transaction.fromRosterId);
    if (fromSleeperId) {
      const previousOrigin = await getOriginSeasonForOwner(
        playerId,
        fromSleeperId,
        targetSeason,
        rosterToSleeperMap,
        visited
      );

      const isOffseasonTrade = isTradeAfterDeadline(txDate, txSeason);

      if (isOffseasonTrade) {
        return {
          originSeason: txSeason >= 8 ? txSeason + 1 : txSeason,
          draftRound: previousOrigin.draftRound
        };
      } else {
        return previousOrigin;
      }
    }
  }

  // Handle waiver/FA
  if (txType !== "TRADE" && transaction.fromRosterId) {
    const fromSleeperId = rosterToSleeperMap.get(transaction.fromRosterId);
    if (fromSleeperId) {
      const dropTx = await prisma.transactionPlayer.findFirst({
        where: {
          playerId,
          fromRosterId: transaction.fromRosterId,
        },
        include: { transaction: true },
      });

      if (dropTx) {
        const dropSeason = getSeasonFromDate(dropTx.transaction.createdAt);
        if (dropSeason === txSeason) {
          return await getOriginSeasonForOwner(
            playerId,
            fromSleeperId,
            targetSeason,
            rosterToSleeperMap,
            visited
          );
        }
      }
    }
  }

  return { originSeason: txSeason };
}

/**
 * POST /api/admin/recalculate-keepers
 *
 * Retroactively recalculates all keeper costs using the corrected logic:
 * - Uses roster time instead of Keeper records
 * - Franchise tags use same cost formula
 * - Offseason trades reset years to 0
 */
export async function POST(request: NextRequest) {
  void request; // Required by Next.js but not used
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Apply rate limiting
    const rateLimit = await checkRateLimit(session.user.id, RATE_LIMITS.admin);
    if (!rateLimit.success) {
      return createRateLimitResponse(
        rateLimit.remaining,
        rateLimit.reset,
        rateLimit.limit
      );
    }

    // Get all keepers
    const keepers = await prisma.keeper.findMany({
      include: {
        player: true,
        roster: {
          include: {
            league: { include: { keeperSettings: true } },
          },
        },
      },
    });

    // Build roster -> sleeper map
    const allRosters = await prisma.roster.findMany({
      select: { id: true, sleeperId: true },
    });

    const rosterToSleeperMap = new Map<string, string>();
    for (const r of allRosters) {
      if (r.sleeperId) {
        rosterToSleeperMap.set(r.id, r.sleeperId);
      }
    }

    const updates: Array<{
      player: string;
      season: number;
      oldCost: number;
      newCost: number;
      year: number;
      baseCost: number;
    }> = [];

    for (const keeper of keepers) {
      const settings = keeper.roster.league.keeperSettings;
      const undraftedRound = settings?.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND;
      const minRound = settings?.minimumRound ?? DEFAULT_KEEPER_RULES.MINIMUM_ROUND;
      const sleeperId = keeper.roster.sleeperId;

      if (!sleeperId) continue;

      // Get origin season
      const origin = await getOriginSeasonForOwner(
        keeper.playerId,
        sleeperId,
        keeper.season,
        rosterToSleeperMap,
        new Set()
      );

      // Calculate years on roster
      const yearsOnRoster = Math.max(0, keeper.season - origin.originSeason);

      // Calculate base cost
      const baseCost = origin.draftRound ?? undraftedRound;

      // Apply cost reduction
      const newFinalCost = Math.max(minRound, baseCost - yearsOnRoster);

      if (newFinalCost !== keeper.finalCost) {
        await prisma.keeper.update({
          where: { id: keeper.id },
          data: { finalCost: newFinalCost },
        });

        updates.push({
          player: keeper.player.fullName,
          season: keeper.season,
          oldCost: keeper.finalCost,
          newCost: newFinalCost,
          year: yearsOnRoster + 1,
          baseCost,
        });
      }
    }

    const response = NextResponse.json({
      success: true,
      message: `Recalculated ${updates.length} keeper costs`,
      total: keepers.length,
      updated: updates.length,
      updates,
    });
    return addRateLimitHeaders(
      response,
      rateLimit.remaining,
      rateLimit.reset,
      rateLimit.limit
    );
  } catch (error) {
    logger.error("Error recalculating keepers", error);
    return NextResponse.json({ error: "Failed to recalculate keepers" }, { status: 500 });
  }
}
