import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getKeeperPlanningSeason } from "@/lib/constants/keeper-rules";
import { DEFAULT_KEEPER_RULES } from "@/lib/constants/keeper-rules";
import { KeeperType } from "@prisma/client";
import { logger } from "@/lib/logger";
import {
  batchComputeKeeperCosts,
  computeKeeperEligibility,
} from "@/lib/keeper/cost";

interface RouteParams {
  params: Promise<{ leagueId: string; rosterId: string }>;
}

/**
 * GET /api/leagues/[leagueId]/rosters/[rosterId]/eligible-keepers
 *
 * REDESIGNED: Uses PlayerAcquisition table as source of truth for costs.
 * Delegates all cost/eligibility logic to the unified cost module (cost.ts).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId, rosterId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this league
    const userAccess = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        rosters: {
          select: {
            teamMembers: {
              where: { userId: session.user.id },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!userAccess || !userAccess.rosters.some((r) => r.teamMembers.length > 0)) {
      return NextResponse.json({ error: "You don't have access to this league" }, { status: 403 });
    }

    const season = getKeeperPlanningSeason();

    // Fetch roster with players, keepers, and league settings
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        league: { include: { keeperSettings: true } },
        rosterPlayers: {
          include: {
            player: {
              include: {
                seasonStats: {
                  where: { season: { gte: season - 4 } },
                  orderBy: { season: "desc" },
                },
              },
            },
          },
        },
        keepers: {
          where: { season: { lte: season } },
          orderBy: { season: "desc" },
        },
      },
    });

    if (!roster || roster.leagueId !== leagueId) {
      return NextResponse.json({ error: "Roster not found" }, { status: 404 });
    }

    const league = roster.league;
    if (!league?.keeperSettings) {
      return NextResponse.json({ error: "League keeper settings not found" }, { status: 400 });
    }

    const settings = league.keeperSettings;
    const currentSleeperId = roster.sleeperId;

    // Get all player IDs on this roster
    const playerIds = roster.rosterPlayers.map((rp) => rp.playerId);

    // BATCH: Compute costs for all players using the unified cost module
    // This reads from PlayerAcquisition table — single source of truth
    const costResults = await batchComputeKeeperCosts(
      playerIds,
      currentSleeperId,
      season,
      settings
    );

    // Current season keepers
    const currentSeasonKeepers = roster.keepers.filter((k) => k.season === season);
    const franchiseCount = currentSeasonKeepers.filter((k) => k.type === KeeperType.FRANCHISE).length;
    const regularCount = currentSeasonKeepers.filter((k) => k.type === KeeperType.REGULAR).length;
    const canAddFranchise = franchiseCount < settings.maxFranchiseTags;

    // Process all players
    const eligiblePlayers = roster.rosterPlayers.map((rp) => {
      const costResult = costResults.get(rp.playerId);
      const eligibility = costResult
        ? computeKeeperEligibility(costResult, settings)
        : { isEligible: true, canBeRegularKeeper: true, mustBeFranchise: false, reason: undefined, cost: null };

      const existingKeeper = currentSeasonKeepers.find((k) => k.playerId === rp.playerId);

      let franchiseCost = null;
      let regularCost = null;
      let effectivelyEligible = eligibility.isEligible;
      let reason = eligibility.reason;

      if (costResult) {
        // Franchise tag cost (same formula, no year limit)
        franchiseCost = {
          baseCost: costResult.baseCost,
          finalCost: costResult.effectiveCost,
          costBreakdown: `Franchise Tag: ${costResult.costBreakdown}`,
        };

        if (eligibility.canBeRegularKeeper) {
          regularCost = {
            baseCost: costResult.baseCost,
            finalCost: costResult.effectiveCost,
            costBreakdown: costResult.costBreakdown,
          };
        } else if (eligibility.mustBeFranchise && !canAddFranchise) {
          effectivelyEligible = false;
          reason = `Year ${costResult.yearsKept} - Franchise Tag required but none available`;
        }
      }

      // Calculate PPG from season stats
      const seasonStats = rp.player.seasonStats || [];
      const seasonsWithData = seasonStats
        .filter((s) => s.gamesPlayed > 0)
        .sort((a, b) => b.season - a.season);

      const lastSeasonStats = seasonsWithData[0] || null;
      const prevSeasonStats = seasonsWithData[1] || null;

      let lastSeasonPpg: number | null = null;
      let isProjected = false;

      if (lastSeasonStats) {
        lastSeasonPpg =
          Math.round((lastSeasonStats.fantasyPointsPpr / lastSeasonStats.gamesPlayed) * 10) / 10;
      } else if (rp.player.projectedPoints && rp.player.projectedPoints > 0) {
        lastSeasonPpg = Math.round((rp.player.projectedPoints / 17) * 10) / 10;
        isProjected = true;
      } else if (rp.player.pointsPerGame && rp.player.pointsPerGame > 0) {
        lastSeasonPpg = Math.round(rp.player.pointsPerGame * 10) / 10;
        isProjected = true;
      }

      const prevSeasonPpg = prevSeasonStats
        ? Math.round((prevSeasonStats.fantasyPointsPpr / prevSeasonStats.gamesPlayed) * 10) / 10
        : null;

      return {
        player: {
          id: rp.player.id,
          sleeperId: rp.player.sleeperId,
          fullName: rp.player.fullName,
          firstName: rp.player.firstName,
          lastName: rp.player.lastName,
          position: rp.player.position,
          team: rp.player.team,
          age: rp.player.age,
          yearsExp: rp.player.yearsExp,
          injuryStatus: rp.player.injuryStatus,
          fantasyPointsPpr: rp.player.fantasyPointsPpr,
          fantasyPointsHalfPpr: rp.player.fantasyPointsHalfPpr,
          gamesPlayed: rp.player.gamesPlayed,
          pointsPerGame: rp.player.pointsPerGame,
          lastSeasonPpg,
          lastSeasonGames: lastSeasonStats?.gamesPlayed ?? null,
          prevSeasonPpg,
          prevSeasonGames: prevSeasonStats?.gamesPlayed ?? null,
          lastSeason: lastSeasonStats?.season ?? (isProjected ? season : season - 1),
          prevSeason: prevSeasonStats?.season ?? season - 2,
          isProjected,
        },
        isStarter: rp.isStarter,
        eligibility: {
          isEligible: effectivelyEligible,
          canBeRegularKeeper: eligibility.canBeRegularKeeper,
          mustBeFranchise: eligibility.mustBeFranchise,
          reason,
          yearsKept: costResult?.yearsKept ?? 1,
          consecutiveYears: (costResult?.yearsKept ?? 1) - 1,
          originSeason: costResult?.originalDraftSeason ?? null,
          acquisitionType: costResult?.acquisitionType ?? "WAIVER",
          originalDraft: costResult?.originalDraftRound
            ? { draftYear: costResult.originalDraftSeason!, draftRound: costResult.originalDraftRound }
            : null,
          _debug: {
            planningSeason: season,
            costBreakdown: costResult?.costBreakdown ?? "No acquisition record",
            isPostDeadlineTrade: costResult?.isPostDeadlineTrade ?? false,
          },
        },
        costs: {
          franchise: franchiseCost,
          regular: regularCost,
        },
        existingKeeper: existingKeeper
          ? {
              id: existingKeeper.id,
              type: existingKeeper.type,
              finalCost: existingKeeper.finalCost,
              isLocked: existingKeeper.isLocked,
            }
          : null,
      };
    });

    // Sort: eligible first, then by position, then by name
    const positionOrder: Record<string, number> = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
    eligiblePlayers.sort((a, b) => {
      if (a.eligibility.isEligible !== b.eligibility.isEligible) {
        return a.eligibility.isEligible ? -1 : 1;
      }
      const posA = positionOrder[a.player.position || ""] || 99;
      const posB = positionOrder[b.player.position || ""] || 99;
      if (posA !== posB) return posA - posB;
      return (a.player.fullName || "").localeCompare(b.player.fullName || "");
    });

    const response = NextResponse.json({
      rosterId,
      season,
      players: eligiblePlayers,
      currentKeepers: {
        franchise: franchiseCount,
        regular: regularCount,
        total: currentSeasonKeepers.length,
      },
      limits: {
        maxKeepers: settings.maxKeepers,
        maxFranchiseTags: settings.maxFranchiseTags,
        maxRegularKeepers: settings.maxRegularKeepers,
      },
      canAddMore: {
        franchise: canAddFranchise,
        regular: regularCount < settings.maxRegularKeepers,
        any: currentSeasonKeepers.length < settings.maxKeepers,
      },
      keeperRules: {
        regularKeeperMaxYears: settings.regularKeeperMaxYears ?? DEFAULT_KEEPER_RULES.REGULAR_KEEPER_MAX_YEARS,
        undraftedRound: settings.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND,
        minimumRound: settings.minimumRound ?? DEFAULT_KEEPER_RULES.MINIMUM_ROUND,
      },
    });

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (error) {
    logger.error("Error fetching eligible keepers", error);
    return NextResponse.json({ error: "Failed to fetch eligible keepers" }, { status: 500 });
  }
}
