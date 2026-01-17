import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { canManageLeague } from "@/lib/permissions";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

// Validation schema for keeper settings
const keeperSettingsSchema = z.object({
  maxKeepers: z.number().min(1).max(20).optional(),
  maxFranchiseTags: z.number().min(0).max(5).optional(),
  maxRegularKeepers: z.number().min(0).max(20).optional(),
  regularKeeperMaxYears: z.number().min(1).max(10).optional(),
  undraftedRound: z.number().min(1).max(20).optional(),
  minimumRound: z.number().min(1).max(5).optional(),
  costReductionPerYear: z.number().min(0).max(3).optional(),
});


/**
 * GET /api/leagues/[leagueId]/settings
 * Get league settings including keeper rules
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

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        keeperSettings: true,
        commissioner: {
          select: {
            id: true,
            displayName: true,
            sleeperUsername: true,
          },
        },
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    const isCommissioner = league.commissionerId === session.user.id;

    // Check user has access
    const hasAccess = await prisma.roster.findFirst({
      where: {
        leagueId,
        teamMembers: {
          some: { userId: session.user.id },
        },
      },
    });

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You don't have access to this league" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      leagueId: league.id,
      leagueName: league.name,
      season: league.season,
      status: league.status,
      isCommissioner,
      commissioner: league.commissioner
        ? {
            id: league.commissioner.id,
            name: league.commissioner.displayName || league.commissioner.sleeperUsername,
          }
        : null,
      keeperSettings: league.keeperSettings || {
        maxKeepers: 7,
        maxFranchiseTags: 2,
        maxRegularKeepers: 5,
        regularKeeperMaxYears: 2,
        undraftedRound: 8,
        minimumRound: 1,
        costReductionPerYear: 1,
      },
      draftSettings: {
        draftRounds: league.draftRounds,
        totalRosters: league.totalRosters,
      },
    });
  } catch (error) {
    logger.error("Error fetching settings", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/leagues/[leagueId]/settings
 * Update league keeper settings (Commissioner only)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify commissioner access
    const hasPermission = await canManageLeague(session.user.id, leagueId);

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Only the commissioner can update league settings" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate keeper settings
    const keeperSettingsResult = keeperSettingsSchema.safeParse(body.keeperSettings);
    if (body.keeperSettings && !keeperSettingsResult.success) {
      return NextResponse.json(
        { error: "Invalid keeper settings", details: keeperSettingsResult.error.issues },
        { status: 400 }
      );
    }

    // Update keeper settings
    if (body.keeperSettings) {
      const settings = keeperSettingsResult.data!;

      // Validate that maxRegularKeepers + maxFranchiseTags <= maxKeepers
      const maxKeepers = settings.maxKeepers ?? 7;
      const maxFT = settings.maxFranchiseTags ?? 2;
      const maxRegular = settings.maxRegularKeepers ?? 5;

      if (maxFT + maxRegular > maxKeepers) {
        return NextResponse.json(
          {
            error: "Invalid configuration",
            message: `Franchise tags (${maxFT}) + Regular keepers (${maxRegular}) cannot exceed max keepers (${maxKeepers})`,
          },
          { status: 400 }
        );
      }

      await prisma.keeperSettings.upsert({
        where: { leagueId },
        update: {
          maxKeepers: settings.maxKeepers,
          maxFranchiseTags: settings.maxFranchiseTags,
          maxRegularKeepers: settings.maxRegularKeepers,
          regularKeeperMaxYears: settings.regularKeeperMaxYears,
          undraftedRound: settings.undraftedRound,
          minimumRound: settings.minimumRound,
          costReductionPerYear: settings.costReductionPerYear,
        },
        create: {
          leagueId,
          maxKeepers: settings.maxKeepers ?? 7,
          maxFranchiseTags: settings.maxFranchiseTags ?? 2,
          maxRegularKeepers: settings.maxRegularKeepers ?? 5,
          regularKeeperMaxYears: settings.regularKeeperMaxYears ?? 2,
          undraftedRound: settings.undraftedRound ?? 8,
          minimumRound: settings.minimumRound ?? 1,
          costReductionPerYear: settings.costReductionPerYear ?? 1,
        },
      });

      // Log the change
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE_KEEPER_SETTINGS",
          entity: "KeeperSettings",
          entityId: leagueId,
          newValue: settings,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error) {
    logger.error("Error updating settings", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leagues/[leagueId]/settings/lock-keepers
 * Lock all keepers for the season (Commissioner only)
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

    // Verify commissioner access
    const hasPermission = await canManageLeague(session.user.id, leagueId);

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Only the commissioner can lock keepers" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === "lock") {
      // Lock all keepers for current season
      const result = await prisma.keeper.updateMany({
        where: {
          roster: { leagueId },
          season: new Date().getFullYear(),
        },
        data: { isLocked: true },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "LOCK_ALL_KEEPERS",
          entity: "League",
          entityId: leagueId,
          newValue: { lockedCount: result.count },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Locked ${result.count} keepers`,
        lockedCount: result.count,
      });
    }

    if (action === "unlock") {
      // Unlock all keepers (commissioner override)
      const result = await prisma.keeper.updateMany({
        where: {
          roster: { leagueId },
          season: new Date().getFullYear(),
        },
        data: { isLocked: false },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UNLOCK_ALL_KEEPERS",
          entity: "League",
          entityId: leagueId,
          newValue: { unlockedCount: result.count },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Unlocked ${result.count} keepers`,
        unlockedCount: result.count,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'lock' or 'unlock'" },
      { status: 400 }
    );
  } catch (error) {
    logger.error("Error locking keepers", error);
    return NextResponse.json(
      { error: "Failed to lock keepers" },
      { status: 500 }
    );
  }
}
