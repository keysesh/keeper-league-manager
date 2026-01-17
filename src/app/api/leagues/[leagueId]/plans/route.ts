import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";
import { KeeperType } from "@prisma/client";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

/**
 * GET /api/leagues/[leagueId]/plans
 * Get all draft plans for a user in this league
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

    // Build query
    const whereClause: {
      leagueId: string;
      season: number;
      rosterId?: string;
      roster?: { teamMembers: { some: { userId: string } } };
    } = {
      leagueId,
      season,
    };

    if (rosterId) {
      whereClause.rosterId = rosterId;
    } else {
      // Only show plans for rosters the user owns
      whereClause.roster = {
        teamMembers: {
          some: { userId: session.user.id },
        },
      };
    }

    const plans = await prisma.draftPlan.findMany({
      where: whereClause,
      include: {
        roster: {
          select: {
            id: true,
            teamName: true,
          },
        },
        planKeepers: {
          include: {
            player: {
              select: {
                id: true,
                sleeperId: true,
                fullName: true,
                position: true,
                team: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      season,
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        isActive: plan.isActive,
        rosterId: plan.rosterId,
        rosterName: plan.roster.teamName,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
        keepers: plan.planKeepers.map((pk) => ({
          playerId: pk.player.id,
          sleeperPlayerId: pk.player.sleeperId,
          playerName: pk.player.fullName,
          position: pk.player.position,
          team: pk.player.team,
          type: pk.type,
        })),
        keeperCount: plan.planKeepers.length,
        franchiseCount: plan.planKeepers.filter((pk) => pk.type === "FRANCHISE")
          .length,
        regularCount: plan.planKeepers.filter((pk) => pk.type === "REGULAR")
          .length,
      })),
    });
  } catch (error) {
    logger.error("Error fetching plans", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leagues/[leagueId]/plans
 * Create or update a draft plan
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
    const { rosterId, name, keepers, season: requestedSeason } = body;
    const season = requestedSeason || getCurrentSeason();

    if (!rosterId || !keepers || !Array.isArray(keepers)) {
      return NextResponse.json(
        { error: "rosterId and keepers array are required" },
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

    // Get keeper settings for validation
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

    // Validate keeper counts
    const franchiseCount = keepers.filter(
      (k: { type: string }) => k.type === "FRANCHISE"
    ).length;
    const regularCount = keepers.filter(
      (k: { type: string }) => k.type === "REGULAR"
    ).length;
    const totalCount = keepers.length;

    if (totalCount > settings.maxKeepers) {
      return NextResponse.json(
        { error: `Maximum ${settings.maxKeepers} keepers allowed` },
        { status: 400 }
      );
    }

    if (franchiseCount > settings.maxFranchiseTags) {
      return NextResponse.json(
        { error: `Maximum ${settings.maxFranchiseTags} franchise tags allowed` },
        { status: 400 }
      );
    }

    if (regularCount > settings.maxRegularKeepers) {
      return NextResponse.json(
        { error: `Maximum ${settings.maxRegularKeepers} regular keepers allowed` },
        { status: 400 }
      );
    }

    // Create or update plan
    const planName = name || "My Plan";

    const plan = await prisma.draftPlan.upsert({
      where: {
        rosterId_season_name: {
          rosterId,
          season,
          name: planName,
        },
      },
      update: {
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        leagueId,
        rosterId,
        season,
        name: planName,
        isActive: true,
      },
    });

    // Clear existing plan keepers
    await prisma.draftPlanKeeper.deleteMany({
      where: { planId: plan.id },
    });

    // Add new plan keepers
    for (const keeper of keepers) {
      const player = await prisma.player.findUnique({
        where: { id: keeper.playerId },
      });

      if (player) {
        await prisma.draftPlanKeeper.create({
          data: {
            planId: plan.id,
            playerId: player.id,
            type: keeper.type === "FRANCHISE" ? KeeperType.FRANCHISE : KeeperType.REGULAR,
          },
        });
      }
    }

    // Fetch updated plan
    const updatedPlan = await prisma.draftPlan.findUnique({
      where: { id: plan.id },
      include: {
        planKeepers: {
          include: {
            player: {
              select: {
                id: true,
                fullName: true,
                position: true,
                team: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      plan: {
        id: updatedPlan?.id,
        name: updatedPlan?.name,
        isActive: updatedPlan?.isActive,
        keepers: updatedPlan?.planKeepers.map((pk) => ({
          playerId: pk.player.id,
          playerName: pk.player.fullName,
          position: pk.player.position,
          team: pk.player.team,
          type: pk.type,
        })),
      },
    });
  } catch (error) {
    logger.error("Error saving plan", error);
    return NextResponse.json(
      { error: "Failed to save plan" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/leagues/[leagueId]/plans
 * Delete a draft plan
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
    const planId = searchParams.get("planId");

    if (!planId) {
      return NextResponse.json(
        { error: "planId is required" },
        { status: 400 }
      );
    }

    // Get plan and verify ownership
    const plan = await prisma.draftPlan.findUnique({
      where: { id: planId },
      include: {
        roster: {
          include: {
            teamMembers: true,
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    if (plan.leagueId !== leagueId) {
      return NextResponse.json(
        { error: "Plan does not belong to this league" },
        { status: 400 }
      );
    }

    const userIsMember = plan.roster.teamMembers.some(
      (tm) => tm.userId === session.user.id
    );

    if (!userIsMember) {
      return NextResponse.json(
        { error: "You don't own this roster" },
        { status: 403 }
      );
    }

    await prisma.draftPlan.delete({
      where: { id: planId },
    });

    return NextResponse.json({
      success: true,
      message: "Plan deleted",
    });
  } catch (error) {
    logger.error("Error deleting plan", error);
    return NextResponse.json(
      { error: "Failed to delete plan" },
      { status: 500 }
    );
  }
}
