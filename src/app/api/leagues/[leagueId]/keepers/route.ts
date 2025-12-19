import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateKeeperEligibility, calculateKeeperCost } from "@/lib/keeper/calculator";
import { recalculateAndApplyCascade } from "@/lib/keeper/cascade";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";
import { KeeperType, AcquisitionType } from "@prisma/client";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

/**
 * GET /api/leagues/[leagueId]/keepers
 * Get all keepers for a league
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get("season") || String(getCurrentSeason()));
    const rosterId = searchParams.get("rosterId");

    // Get league with keeper settings
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        keeperSettings: true,
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    // Build query
    const whereClause: {
      roster: { leagueId: string };
      season: number;
      rosterId?: string;
    } = {
      roster: { leagueId },
      season,
    };

    if (rosterId) {
      whereClause.rosterId = rosterId;
    }

    const keepers = await prisma.keeper.findMany({
      where: whereClause,
      include: {
        player: true,
        roster: {
          select: {
            id: true,
            teamName: true,
            sleeperId: true,
          },
        },
      },
      orderBy: [
        { type: "asc" }, // Franchise first
        { finalCost: "asc" }, // Then by cost
      ],
    });

    // Group by roster
    const keepersByRoster = keepers.reduce((acc, keeper) => {
      if (!acc[keeper.rosterId]) {
        acc[keeper.rosterId] = {
          roster: keeper.roster,
          keepers: [],
          franchiseCount: 0,
          regularCount: 0,
        };
      }
      acc[keeper.rosterId].keepers.push(keeper);
      if (keeper.type === KeeperType.FRANCHISE) {
        acc[keeper.rosterId].franchiseCount++;
      } else {
        acc[keeper.rosterId].regularCount++;
      }
      return acc;
    }, {} as Record<string, {
      roster: { id: string; teamName: string | null; sleeperId: string };
      keepers: typeof keepers;
      franchiseCount: number;
      regularCount: number;
    }>);

    return NextResponse.json({
      season,
      settings: league.keeperSettings,
      keepers: keepers.map(k => ({
        id: k.id,
        rosterId: k.rosterId,
        rosterName: k.roster.teamName,
        player: {
          id: k.player.id,
          sleeperId: k.player.sleeperId,
          fullName: k.player.fullName,
          position: k.player.position,
          team: k.player.team,
        },
        type: k.type,
        baseCost: k.baseCost,
        finalCost: k.finalCost,
        yearsKept: k.yearsKept,
        acquisitionType: k.acquisitionType,
        isLocked: k.isLocked,
        notes: k.notes,
      })),
      byRoster: keepersByRoster,
    });
  } catch (error) {
    console.error("Error fetching keepers:", error);
    return NextResponse.json(
      { error: "Failed to fetch keepers" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leagues/[leagueId]/keepers
 * Add a keeper for a roster
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { rosterId, playerId, type, notes } = body;

    if (!rosterId || !playerId || !type) {
      return NextResponse.json(
        { error: "rosterId, playerId, and type are required" },
        { status: 400 }
      );
    }

    // Verify user owns this roster
    const roster = await prisma.roster.findFirst({
      where: {
        id: rosterId,
        leagueId,
        teamMembers: {
          some: { userId: session.user.id },
        },
      },
    });

    if (!roster) {
      return NextResponse.json(
        { error: "You don't own this roster" },
        { status: 403 }
      );
    }

    // Get league settings
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: { keeperSettings: true },
    });

    if (!league?.keeperSettings) {
      return NextResponse.json(
        { error: "League keeper settings not configured" },
        { status: 400 }
      );
    }

    const settings = league.keeperSettings;
    const season = getCurrentSeason();

    // Check current keeper counts
    const existingKeepers = await prisma.keeper.findMany({
      where: {
        rosterId,
        season,
      },
    });

    const franchiseCount = existingKeepers.filter(k => k.type === KeeperType.FRANCHISE).length;
    const regularCount = existingKeepers.filter(k => k.type === KeeperType.REGULAR).length;
    const totalCount = existingKeepers.length;

    // Validate against limits
    if (totalCount >= settings.maxKeepers) {
      return NextResponse.json(
        { error: `Maximum ${settings.maxKeepers} keepers allowed` },
        { status: 400 }
      );
    }

    if (type === "FRANCHISE" && franchiseCount >= settings.maxFranchiseTags) {
      return NextResponse.json(
        { error: `Maximum ${settings.maxFranchiseTags} franchise tags allowed` },
        { status: 400 }
      );
    }

    if (type === "REGULAR" && regularCount >= settings.maxRegularKeepers) {
      return NextResponse.json(
        { error: `Maximum ${settings.maxRegularKeepers} regular keepers allowed` },
        { status: 400 }
      );
    }

    // Check player eligibility
    const eligibility = await calculateKeeperEligibility(
      playerId,
      rosterId,
      leagueId,
      season
    );

    if (!eligibility.isEligible) {
      return NextResponse.json(
        { error: eligibility.reason },
        { status: 400 }
      );
    }

    // Calculate cost
    const cost = await calculateKeeperCost(
      playerId,
      rosterId,
      leagueId,
      season,
      type === "FRANCHISE" ? KeeperType.FRANCHISE : KeeperType.REGULAR
    );

    // Create keeper
    const keeper = await prisma.keeper.create({
      data: {
        rosterId,
        playerId,
        season,
        type: type === "FRANCHISE" ? KeeperType.FRANCHISE : KeeperType.REGULAR,
        baseCost: cost.baseCost,
        finalCost: cost.finalCost,
        yearsKept: eligibility.yearsKept,
        acquisitionType: eligibility.acquisitionType,
        notes,
      },
      include: {
        player: true,
      },
    });

    // Auto-recalculate cascade for all keepers in the league
    const cascadeResult = await recalculateAndApplyCascade(leagueId, season);

    // Fetch the updated keeper with the recalculated finalCost
    const updatedKeeper = await prisma.keeper.findUnique({
      where: { id: keeper.id },
      include: { player: true },
    });

    return NextResponse.json({
      success: true,
      keeper: {
        id: updatedKeeper?.id || keeper.id,
        player: {
          id: keeper.player.id,
          fullName: keeper.player.fullName,
          position: keeper.player.position,
          team: keeper.player.team,
        },
        type: keeper.type,
        baseCost: keeper.baseCost,
        finalCost: updatedKeeper?.finalCost || keeper.finalCost,
        yearsKept: keeper.yearsKept,
      },
      cascadeUpdated: cascadeResult.updatedCount,
    });
  } catch (error) {
    console.error("Error creating keeper:", error);
    return NextResponse.json(
      { error: "Failed to create keeper" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/leagues/[leagueId]/keepers
 * Remove a keeper
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const keeperId = searchParams.get("keeperId");

    if (!keeperId) {
      return NextResponse.json(
        { error: "keeperId is required" },
        { status: 400 }
      );
    }

    // Get keeper and verify ownership
    const keeper = await prisma.keeper.findUnique({
      where: { id: keeperId },
      include: {
        roster: {
          include: {
            teamMembers: true,
          },
        },
      },
    });

    if (!keeper) {
      return NextResponse.json(
        { error: "Keeper not found" },
        { status: 404 }
      );
    }

    if (keeper.roster.leagueId !== leagueId) {
      return NextResponse.json(
        { error: "Keeper does not belong to this league" },
        { status: 400 }
      );
    }

    const userIsMember = keeper.roster.teamMembers.some(
      tm => tm.userId === session.user.id
    );

    if (!userIsMember) {
      return NextResponse.json(
        { error: "You don't own this roster" },
        { status: 403 }
      );
    }

    if (keeper.isLocked) {
      return NextResponse.json(
        { error: "This keeper is locked and cannot be removed" },
        { status: 400 }
      );
    }

    // Store the season before deleting
    const keeperSeason = keeper.season;

    await prisma.keeper.delete({
      where: { id: keeperId },
    });

    // Auto-recalculate cascade for all keepers in the league
    const cascadeResult = await recalculateAndApplyCascade(leagueId, keeperSeason);

    return NextResponse.json({
      success: true,
      message: "Keeper removed",
      cascadeUpdated: cascadeResult.updatedCount,
    });
  } catch (error) {
    console.error("Error deleting keeper:", error);
    return NextResponse.json(
      { error: "Failed to delete keeper" },
      { status: 500 }
    );
  }
}
