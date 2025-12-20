import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
 *
 * OPTIMIZED: Single query to fetch all needed data, minimal DB writes
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
    const { rosterId, playerId, type, notes, baseCost, finalCost, yearsKept } = body;

    if (!rosterId || !playerId || !type) {
      return NextResponse.json(
        { error: "rosterId, playerId, and type are required" },
        { status: 400 }
      );
    }

    // OPTIMIZED: Single query to get roster, league settings, existing keepers, and player
    const [rosterWithData, player] = await Promise.all([
      prisma.roster.findFirst({
        where: {
          id: rosterId,
          leagueId,
          teamMembers: {
            some: { userId: session.user.id },
          },
        },
        include: {
          league: {
            include: { keeperSettings: true },
          },
          keepers: {
            where: { season: getCurrentSeason() },
          },
        },
      }),
      prisma.player.findUnique({
        where: { id: playerId },
      }),
    ]);

    if (!rosterWithData) {
      return NextResponse.json(
        { error: "You don't own this roster" },
        { status: 403 }
      );
    }

    if (!player) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    const settings = rosterWithData.league.keeperSettings;
    if (!settings) {
      return NextResponse.json(
        { error: "League keeper settings not configured" },
        { status: 400 }
      );
    }

    const season = getCurrentSeason();
    const existingKeepers = rosterWithData.keepers;

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

    // Check if already a keeper
    if (existingKeepers.some(k => k.playerId === playerId)) {
      return NextResponse.json(
        { error: "Player is already a keeper" },
        { status: 400 }
      );
    }

    // Use client-provided cost data (calculated in eligible-keepers route)
    // This avoids expensive recalculation
    const keeperType = type === "FRANCHISE" ? KeeperType.FRANCHISE : KeeperType.REGULAR;
    const effectiveBaseCost = keeperType === KeeperType.FRANCHISE ? 1 : (baseCost || settings.undraftedRound);
    const effectiveFinalCost = keeperType === KeeperType.FRANCHISE ? 1 : (finalCost || effectiveBaseCost);
    const effectiveYearsKept = yearsKept || 1;

    // Create keeper with provided or default values
    const keeper = await prisma.keeper.create({
      data: {
        rosterId,
        playerId,
        season,
        type: keeperType,
        baseCost: effectiveBaseCost,
        finalCost: effectiveFinalCost,
        yearsKept: effectiveYearsKept,
        acquisitionType: AcquisitionType.DRAFTED, // Default, will be corrected by sync
        notes,
      },
      include: {
        player: true,
      },
    });

    // Skip cascade recalculation for speed - cascade is calculated on-demand when viewing draft board

    return NextResponse.json({
      success: true,
      keeper: {
        id: keeper.id,
        player: {
          id: keeper.player.id,
          fullName: keeper.player.fullName,
          position: keeper.player.position,
          team: keeper.player.team,
        },
        type: keeper.type,
        baseCost: keeper.baseCost,
        finalCost: keeper.finalCost,
        yearsKept: keeper.yearsKept,
      },
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
 *
 * OPTIMIZED: Single query, skip cascade recalculation
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

    // Get keeper and verify ownership in single query
    const keeper = await prisma.keeper.findUnique({
      where: { id: keeperId },
      include: {
        roster: {
          select: {
            leagueId: true,
            teamMembers: {
              where: { userId: session.user.id },
              select: { id: true },
            },
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

    if (keeper.roster.teamMembers.length === 0) {
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

    await prisma.keeper.delete({
      where: { id: keeperId },
    });

    // Skip cascade recalculation for speed - cascade is calculated on-demand

    return NextResponse.json({
      success: true,
      message: "Keeper removed",
    });
  } catch (error) {
    console.error("Error deleting keeper:", error);
    return NextResponse.json(
      { error: "Failed to delete keeper" },
      { status: 500 }
    );
  }
}
