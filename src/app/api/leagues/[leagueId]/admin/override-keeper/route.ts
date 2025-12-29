import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageLeague } from "@/lib/permissions";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

const OverrideKeeperSchema = z.object({
  action: z.enum(["add", "remove", "update"]),
  playerId: z.string(),
  rosterId: z.string(),
  season: z.number(),
  type: z.enum(["REGULAR", "FRANCHISE"]).optional(),
  finalCost: z.number().min(1).max(16).optional(),
  reason: z.string().min(1).max(500),
});

/**
 * POST /api/leagues/[leagueId]/admin/override-keeper
 * Commissioner override for keeper management
 *
 * Allows commissioners to:
 * - Add a keeper that wouldn't normally be eligible
 * - Remove a keeper
 * - Change keeper type or cost
 *
 * All overrides are logged in the audit log with the reason
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

    // Check if user can manage this league (commissioner or admin)
    const canManage = await canManageLeague(session.user.id, leagueId);
    if (!canManage) {
      return NextResponse.json(
        { error: "You don't have permission to manage this league" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = OverrideKeeperSchema.parse(body);

    // Verify the roster belongs to this league
    const roster = await prisma.roster.findFirst({
      where: {
        id: validatedData.rosterId,
        leagueId,
      },
      include: { league: true },
    });

    if (!roster) {
      return NextResponse.json(
        { error: "Roster not found in this league" },
        { status: 404 }
      );
    }

    // Verify the player exists
    const player = await prisma.player.findUnique({
      where: { id: validatedData.playerId },
    });

    if (!player) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    let result;
    const auditDetails: Record<string, unknown> = {
      action: validatedData.action,
      playerId: validatedData.playerId,
      playerName: player.fullName,
      rosterId: validatedData.rosterId,
      season: validatedData.season,
      reason: validatedData.reason,
      overriddenBy: session.user.id,
    };

    switch (validatedData.action) {
      case "add": {
        // Add a keeper (even if not normally eligible)
        const existingKeeper = await prisma.keeper.findUnique({
          where: {
            rosterId_playerId_season: {
              rosterId: validatedData.rosterId,
              playerId: validatedData.playerId,
              season: validatedData.season,
            },
          },
        });

        if (existingKeeper) {
          return NextResponse.json(
            { error: "Player is already a keeper for this season" },
            { status: 400 }
          );
        }

        result = await prisma.keeper.create({
          data: {
            playerId: validatedData.playerId,
            rosterId: validatedData.rosterId,
            season: validatedData.season,
            type: validatedData.type || "REGULAR",
            baseCost: validatedData.finalCost || 10,
            finalCost: validatedData.finalCost || 10,
            acquisitionType: "WAIVER",
            notes: `[Commissioner Override] ${validatedData.reason}`,
          },
        });

        auditDetails.type = validatedData.type || "REGULAR";
        auditDetails.finalCost = validatedData.finalCost || 10;
        break;
      }

      case "remove": {
        // Remove a keeper
        const keeper = await prisma.keeper.findUnique({
          where: {
            rosterId_playerId_season: {
              rosterId: validatedData.rosterId,
              playerId: validatedData.playerId,
              season: validatedData.season,
            },
          },
        });

        if (!keeper) {
          return NextResponse.json(
            { error: "Keeper not found" },
            { status: 404 }
          );
        }

        await prisma.keeper.delete({
          where: { id: keeper.id },
        });

        result = { deleted: true, keeperId: keeper.id };
        auditDetails.previousType = keeper.type;
        auditDetails.previousCost = keeper.finalCost;
        break;
      }

      case "update": {
        // Update keeper type or cost
        const keeperToUpdate = await prisma.keeper.findUnique({
          where: {
            rosterId_playerId_season: {
              rosterId: validatedData.rosterId,
              playerId: validatedData.playerId,
              season: validatedData.season,
            },
          },
        });

        if (!keeperToUpdate) {
          return NextResponse.json(
            { error: "Keeper not found" },
            { status: 404 }
          );
        }

        auditDetails.previousType = keeperToUpdate.type;
        auditDetails.previousCost = keeperToUpdate.finalCost;

        result = await prisma.keeper.update({
          where: { id: keeperToUpdate.id },
          data: {
            type: validatedData.type || keeperToUpdate.type,
            finalCost: validatedData.finalCost ?? keeperToUpdate.finalCost,
            notes: `[Commissioner Override] ${validatedData.reason}`,
          },
        });

        auditDetails.newType = result.type;
        auditDetails.newCost = result.finalCost;
        break;
      }
    }

    // Log the override action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "KeeperOverride",
        entityId: leagueId,
        newValue: JSON.parse(JSON.stringify(auditDetails)),
      },
    });

    return NextResponse.json({
      success: true,
      action: validatedData.action,
      result,
      message: `Keeper ${validatedData.action} successful. Reason: ${validatedData.reason}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error overriding keeper:", error);
    return NextResponse.json(
      { error: "Failed to override keeper" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leagues/[leagueId]/admin/override-keeper
 * Get all commissioner overrides for a league
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

    const canManage = await canManageLeague(session.user.id, leagueId);
    if (!canManage) {
      return NextResponse.json(
        { error: "You don't have permission to view this" },
        { status: 403 }
      );
    }

    // Get all keepers that were overridden (identified by notes prefix)
    const overriddenKeepers = await prisma.keeper.findMany({
      where: {
        roster: { leagueId },
        notes: { startsWith: "[Commissioner Override]" },
      },
      include: {
        player: {
          select: { fullName: true, position: true, team: true },
        },
        roster: {
          select: { teamName: true },
        },
      },
      orderBy: { season: "desc" },
    });

    // Get audit logs for overrides
    const overrideAuditLogs = await prisma.auditLog.findMany({
      where: {
        entity: "KeeperOverride",
        entityId: leagueId,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Fetch user info separately since AuditLog doesn't have a user relation
    const userIds = overrideAuditLogs.map((l) => l.userId).filter(Boolean) as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, sleeperUsername: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    // Attach user info to logs
    const logsWithUsers = overrideAuditLogs.map((log) => ({
      ...log,
      user: log.userId ? userMap[log.userId] : null,
    }));

    return NextResponse.json({
      overriddenKeepers,
      auditLogs: logsWithUsers,
    });
  } catch (error) {
    console.error("Error fetching override history:", error);
    return NextResponse.json(
      { error: "Failed to fetch override history" },
      { status: 500 }
    );
  }
}
