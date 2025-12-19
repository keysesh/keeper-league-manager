import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateKeeperEligibility, calculateKeeperCost } from "@/lib/keeper/calculator";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";
import { KeeperType } from "@prisma/client";

interface RouteParams {
  params: Promise<{ leagueId: string; rosterId: string }>;
}

/**
 * GET /api/leagues/[leagueId]/rosters/[rosterId]/eligible-keepers
 * Get all players on a roster with their keeper eligibility
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId, rosterId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const season = getCurrentSeason();

    // Get roster with players
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        rosterPlayers: {
          include: {
            player: true,
          },
        },
        keepers: {
          where: { season },
        },
      },
    });

    if (!roster || roster.leagueId !== leagueId) {
      return NextResponse.json(
        { error: "Roster not found" },
        { status: 404 }
      );
    }

    // Get league settings
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: { keeperSettings: true },
    });

    if (!league?.keeperSettings) {
      return NextResponse.json(
        { error: "League keeper settings not found" },
        { status: 400 }
      );
    }

    // Check eligibility for each player
    const eligiblePlayers = await Promise.all(
      roster.rosterPlayers.map(async (rp) => {
        const eligibility = await calculateKeeperEligibility(
          rp.playerId,
          rosterId,
          leagueId,
          season
        );

        // Calculate costs for both keeper types if eligible
        let franchiseCost = null;
        let regularCost = null;

        if (eligibility.isEligible) {
          const [fc, rc] = await Promise.all([
            calculateKeeperCost(rp.playerId, rosterId, leagueId, season, KeeperType.FRANCHISE),
            calculateKeeperCost(rp.playerId, rosterId, leagueId, season, KeeperType.REGULAR),
          ]);
          franchiseCost = fc;
          regularCost = rc;
        }

        // Check if already a keeper
        const existingKeeper = roster.keepers.find((k) => k.playerId === rp.playerId);

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
          },
          isStarter: rp.isStarter,
          eligibility: {
            isEligible: eligibility.isEligible,
            reason: eligibility.reason,
            yearsKept: eligibility.yearsKept,
            acquisitionType: eligibility.acquisitionType,
          },
          costs: {
            franchise: franchiseCost
              ? {
                  baseCost: franchiseCost.baseCost,
                  finalCost: franchiseCost.finalCost,
                  costBreakdown: franchiseCost.costBreakdown,
                }
              : null,
            regular: regularCost
              ? {
                  baseCost: regularCost.baseCost,
                  finalCost: regularCost.finalCost,
                  costBreakdown: regularCost.costBreakdown,
                }
              : null,
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
      })
    );

    // Sort: eligible first, then by position, then by name
    const positionOrder: Record<string, number> = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
    eligiblePlayers.sort((a, b) => {
      // Eligible players first
      if (a.eligibility.isEligible !== b.eligibility.isEligible) {
        return a.eligibility.isEligible ? -1 : 1;
      }
      // Then by position
      const posA = positionOrder[a.player.position || ""] || 99;
      const posB = positionOrder[b.player.position || ""] || 99;
      if (posA !== posB) return posA - posB;
      // Then alphabetically
      return (a.player.fullName || "").localeCompare(b.player.fullName || "");
    });

    // Get current keeper counts
    const franchiseCount = roster.keepers.filter((k) => k.type === KeeperType.FRANCHISE).length;
    const regularCount = roster.keepers.filter((k) => k.type === KeeperType.REGULAR).length;

    const response = NextResponse.json({
      rosterId,
      season,
      players: eligiblePlayers,
      currentKeepers: {
        franchise: franchiseCount,
        regular: regularCount,
        total: roster.keepers.length,
      },
      limits: {
        maxKeepers: league.keeperSettings.maxKeepers,
        maxFranchiseTags: league.keeperSettings.maxFranchiseTags,
        maxRegularKeepers: league.keeperSettings.maxRegularKeepers,
      },
      canAddMore: {
        franchise: franchiseCount < league.keeperSettings.maxFranchiseTags,
        regular: regularCount < league.keeperSettings.maxRegularKeepers,
        any: roster.keepers.length < league.keeperSettings.maxKeepers,
      },
    });

    // Cache for 15 seconds, stale-while-revalidate for 30 seconds
    response.headers.set('Cache-Control', 'private, s-maxage=15, stale-while-revalidate=30');
    return response;
  } catch (error) {
    console.error("Error fetching eligible keepers:", error);
    return NextResponse.json(
      { error: "Failed to fetch eligible keepers" },
      { status: 500 }
    );
  }
}
