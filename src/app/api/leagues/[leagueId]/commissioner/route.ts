import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

function createApiError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: message, details, timestamp: new Date().toISOString() },
    { status }
  );
}

const UpdateKeeperSchema = z.object({
  action: z.literal("updateKeeper"),
  keeperId: z.string(),
  updates: z.object({
    type: z.enum(["FRANCHISE", "REGULAR"]).optional(),
    baseCost: z.number().min(1).max(16).optional(),
    finalCost: z.number().min(1).max(16).optional(),
    yearsKept: z.number().min(1).max(10).optional(),
    isLocked: z.boolean().optional(),
    notes: z.string().max(500).optional(),
  }),
});

const DeleteKeeperSchema = z.object({
  action: z.literal("deleteKeeper"),
  keeperId: z.string(),
  reason: z.string().max(200).optional(),
});

const CreateKeeperSchema = z.object({
  action: z.literal("createKeeper"),
  rosterId: z.string(),
  playerId: z.string(),
  type: z.enum(["FRANCHISE", "REGULAR"]),
  baseCost: z.number().min(1).max(16),
  finalCost: z.number().min(1).max(16),
  yearsKept: z.number().min(1).max(10).default(1),
  notes: z.string().max(500).optional(),
});

const LockKeepersSchema = z.object({
  action: z.literal("lockKeepers"),
  lock: z.boolean(),
  rosterIds: z.array(z.string()).optional(), // If not provided, affects all rosters
});

const ResetSyncSchema = z.object({
  action: z.literal("resetSync"),
  confirmationCode: z.string(),
});

const UpdateSettingsSchema = z.object({
  action: z.literal("updateSettings"),
  settings: z.object({
    maxKeepers: z.number().min(0).max(20).optional(),
    maxFranchiseTags: z.number().min(0).max(10).optional(),
    maxRegularKeepers: z.number().min(0).max(20).optional(),
    regularKeeperMaxYears: z.number().min(1).max(10).optional(),
    undraftedRound: z.number().min(1).max(20).optional(),
    minimumRound: z.number().min(1).max(20).optional(),
    costReductionPerYear: z.number().min(0).max(5).optional(),
  }),
});

const ActionSchema = z.discriminatedUnion("action", [
  UpdateKeeperSchema,
  DeleteKeeperSchema,
  CreateKeeperSchema,
  LockKeepersSchema,
  ResetSyncSchema,
  UpdateSettingsSchema,
]);

async function verifyCommissioner(leagueId: string, userId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { commissionerId: true, name: true },
  });

  if (!league) {
    throw new Error("League not found");
  }

  if (league.commissionerId !== userId) {
    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      throw new Error("Only the commissioner can perform this action");
    }
  }

  return league;
}

/**
 * GET /api/leagues/[leagueId]/commissioner
 * Get commissioner tools data
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId } = await params;

    if (!session?.user?.id) {
      return createApiError("Authentication required", 401);
    }

    const league = await verifyCommissioner(leagueId, session.user.id);

    // Get all data needed for commissioner tools
    const [rosters, keepers, settings, auditLogs] = await Promise.all([
      prisma.roster.findMany({
        where: { leagueId },
        include: {
          teamMembers: {
            include: {
              user: { select: { displayName: true, sleeperUsername: true } },
            },
          },
          keepers: {
            include: {
              player: { select: { id: true, fullName: true, position: true } },
            },
          },
          _count: {
            select: { rosterPlayers: true },
          },
        },
        orderBy: { teamName: "asc" },
      }),
      prisma.keeper.findMany({
        where: { roster: { leagueId } },
        include: {
          player: { select: { id: true, fullName: true, position: true } },
          roster: { select: { id: true, teamName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.keeperSettings.findUnique({
        where: { leagueId },
      }),
      prisma.auditLog.findMany({
        where: { entityId: leagueId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return NextResponse.json({
      league: {
        id: leagueId,
        name: league.name,
      },
      rosters: rosters.map((r) => ({
        id: r.id,
        teamName: r.teamName,
        owner: r.teamMembers[0]?.user,
        playerCount: r._count.rosterPlayers,
        keeperCount: r.keepers.length,
        keepers: r.keepers.map((k) => ({
          id: k.id,
          player: k.player,
          type: k.type,
          baseCost: k.baseCost,
          finalCost: k.finalCost,
          yearsKept: k.yearsKept,
          isLocked: k.isLocked,
          notes: k.notes,
        })),
      })),
      keepers: keepers.map((k) => ({
        id: k.id,
        player: k.player,
        roster: k.roster,
        type: k.type,
        baseCost: k.baseCost,
        finalCost: k.finalCost,
        yearsKept: k.yearsKept,
        isLocked: k.isLocked,
        notes: k.notes,
        season: k.season,
        createdAt: k.createdAt.toISOString(),
      })),
      settings,
      recentActivity: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        createdAt: log.createdAt.toISOString(),
        userId: log.userId,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("commissioner")) {
      return createApiError(error.message, 403);
    }
    console.error("Error fetching commissioner data:", error);
    return createApiError(
      "Failed to fetch commissioner data",
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

/**
 * POST /api/leagues/[leagueId]/commissioner
 * Perform commissioner actions
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId } = await params;

    if (!session?.user?.id) {
      return createApiError("Authentication required", 401);
    }

    await verifyCommissioner(leagueId, session.user.id);

    const body = await request.json();
    const action = ActionSchema.parse(body);

    switch (action.action) {
      case "updateKeeper": {
        const keeper = await prisma.keeper.update({
          where: { id: action.keeperId },
          data: action.updates,
        });

        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "COMMISSIONER_UPDATE_KEEPER",
            entity: "Keeper",
            entityId: action.keeperId,
            oldValue: action,
            newValue: keeper,
          },
        });

        return NextResponse.json({
          success: true,
          message: "Keeper updated successfully",
          keeper,
        });
      }

      case "deleteKeeper": {
        const keeper = await prisma.keeper.findUnique({
          where: { id: action.keeperId },
          include: { player: true, roster: true },
        });

        await prisma.keeper.delete({
          where: { id: action.keeperId },
        });

        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "COMMISSIONER_DELETE_KEEPER",
            entity: "Keeper",
            entityId: action.keeperId,
            oldValue: keeper ? {
              playerId: keeper.player?.id,
              playerName: keeper.player?.fullName,
              rosterId: keeper.roster?.id,
              rosterName: keeper.roster?.teamName,
            } : undefined,
            newValue: { reason: action.reason },
          },
        });

        return NextResponse.json({
          success: true,
          message: `Removed ${keeper?.player?.fullName} as keeper from ${keeper?.roster?.teamName}`,
        });
      }

      case "createKeeper": {
        // Verify roster and player exist
        const [roster, player] = await Promise.all([
          prisma.roster.findUnique({
            where: { id: action.rosterId, leagueId },
          }),
          prisma.player.findUnique({
            where: { id: action.playerId },
          }),
        ]);

        if (!roster || !player) {
          return createApiError("Invalid roster or player ID", 400);
        }

        const currentYear = new Date().getFullYear();

        const keeper = await prisma.keeper.create({
          data: {
            rosterId: action.rosterId,
            playerId: action.playerId,
            season: currentYear,
            type: action.type,
            baseCost: action.baseCost,
            finalCost: action.finalCost,
            yearsKept: action.yearsKept,
            acquisitionType: "COMMISSIONER",
            notes: action.notes || "Created by commissioner",
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "COMMISSIONER_CREATE_KEEPER",
            entity: "Keeper",
            entityId: keeper.id,
            newValue: {
              player: player.fullName,
              roster: roster.teamName,
              ...action,
            },
          },
        });

        return NextResponse.json({
          success: true,
          message: `Added ${player.fullName} as keeper for ${roster.teamName}`,
          keeper,
        });
      }

      case "lockKeepers": {
        const where = action.rosterIds
          ? { id: { in: action.rosterIds }, leagueId }
          : { leagueId };

        // Lock/unlock all keepers for the specified rosters
        const result = await prisma.keeper.updateMany({
          where: { roster: where },
          data: { isLocked: action.lock },
        });

        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: action.lock ? "COMMISSIONER_LOCK_KEEPERS" : "COMMISSIONER_UNLOCK_KEEPERS",
            entity: "League",
            entityId: leagueId,
            newValue: {
              affectedKeepers: result.count,
              rosterIds: action.rosterIds || "all",
            },
          },
        });

        return NextResponse.json({
          success: true,
          message: `${action.lock ? "Locked" : "Unlocked"} ${result.count} keepers`,
          count: result.count,
        });
      }

      case "resetSync": {
        // Verify confirmation code (use league ID hash)
        const expectedCode = leagueId.slice(-6).toUpperCase();
        if (action.confirmationCode !== expectedCode) {
          return createApiError(
            `Invalid confirmation code. Please enter: ${expectedCode}`,
            400
          );
        }

        // Reset sync data (clear cached data, force resync)
        await prisma.$transaction([
          // Update league last synced to null to force resync
          prisma.league.update({
            where: { id: leagueId },
            data: { lastSyncedAt: null },
          }),
          prisma.auditLog.create({
            data: {
              userId: session.user.id,
              action: "COMMISSIONER_RESET_SYNC",
              entity: "League",
              entityId: leagueId,
            },
          }),
        ]);

        return NextResponse.json({
          success: true,
          message: "Sync data reset. Please trigger a new sync.",
        });
      }

      case "updateSettings": {
        const settings = await prisma.keeperSettings.upsert({
          where: { leagueId },
          update: action.settings,
          create: {
            leagueId,
            ...action.settings,
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "COMMISSIONER_UPDATE_SETTINGS",
            entity: "KeeperSettings",
            entityId: settings.id,
            newValue: action.settings,
          },
        });

        return NextResponse.json({
          success: true,
          message: "Keeper settings updated",
          settings,
        });
      }

      default:
        return createApiError("Unknown action", 400);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiError("Invalid request data", 400, error.issues);
    }
    if (error instanceof Error && error.message.includes("commissioner")) {
      return createApiError(error.message, 403);
    }
    console.error("Error performing commissioner action:", error);
    return createApiError(
      "Failed to perform action",
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}
