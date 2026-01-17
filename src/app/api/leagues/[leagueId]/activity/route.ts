import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

export interface ActivityItem {
  id: string;
  type: "KEEPER_ADDED" | "KEEPER_REMOVED" | "KEEPER_LOCKED" | "TRADE" | "SETTINGS_CHANGED" | "SYNC";
  description: string;
  timestamp: string;
  actor: {
    id: string;
    name: string;
    avatar: string | null;
  } | null;
  metadata: Record<string, unknown>;
}

/**
 * GET /api/leagues/[leagueId]/activity
 * Get recent activity for a league
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const season = parseInt(searchParams.get("season") || String(getCurrentSeason()));

    // Get audit logs for this league
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entity: { in: ["Keeper", "KeeperSettings", "League"] },
        entityId: leagueId,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Get recent keeper changes
    const recentKeepers = await prisma.keeper.findMany({
      where: {
        roster: { leagueId },
        season,
      },
      include: {
        player: true,
        roster: {
          include: {
            teamMembers: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    sleeperUsername: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Get recent transactions
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        leagueId,
        type: "TRADE",
      },
      include: {
        players: {
          include: {
            player: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Build activity feed
    const activities: ActivityItem[] = [];

    // Add keeper activities
    for (const keeper of recentKeepers) {
      const owner = keeper.roster.teamMembers[0]?.user;
      activities.push({
        id: `keeper-${keeper.id}`,
        type: "KEEPER_ADDED",
        description: `${keeper.roster.teamName || "A team"} designated ${keeper.player.fullName} as a ${keeper.type === "FRANCHISE" ? "Franchise Tag" : "keeper"} (Round ${keeper.finalCost})`,
        timestamp: keeper.createdAt.toISOString(),
        actor: owner
          ? {
              id: owner.id,
              name: owner.displayName || owner.sleeperUsername,
              avatar: owner.avatar,
            }
          : null,
        metadata: {
          playerId: keeper.playerId,
          playerName: keeper.player.fullName,
          position: keeper.player.position,
          team: keeper.player.team,
          keeperType: keeper.type,
          cost: keeper.finalCost,
          rosterId: keeper.rosterId,
          rosterName: keeper.roster.teamName,
        },
      });
    }

    // Add trade activities
    for (const transaction of recentTransactions) {
      const playerNames = transaction.players.map((p) => p.player.fullName).join(", ");
      activities.push({
        id: `trade-${transaction.id}`,
        type: "TRADE",
        description: `Trade completed involving ${playerNames}`,
        timestamp: transaction.createdAt.toISOString(),
        actor: null,
        metadata: {
          transactionId: transaction.id,
          players: transaction.players.map((p) => ({
            playerId: p.playerId,
            playerName: p.player.fullName,
            fromRosterId: p.fromRosterId,
            toRosterId: p.toRosterId,
          })),
        },
      });
    }

    // Add audit log activities
    for (const log of auditLogs) {
      let description = log.action;
      let type: ActivityItem["type"] = "SETTINGS_CHANGED";

      switch (log.action) {
        case "UPDATE_KEEPER_SETTINGS":
          description = "League keeper settings were updated";
          break;
        case "LOCK_ALL_KEEPERS":
          type = "KEEPER_LOCKED";
          description = "All keepers were locked for the season";
          break;
        case "UNLOCK_ALL_KEEPERS":
          type = "KEEPER_LOCKED";
          description = "All keepers were unlocked";
          break;
        default:
          description = log.action.replace(/_/g, " ").toLowerCase();
      }

      activities.push({
        id: `audit-${log.id}`,
        type,
        description,
        timestamp: log.createdAt.toISOString(),
        actor: null,
        metadata: {
          action: log.action,
          oldValue: log.oldValue,
          newValue: log.newValue,
        },
      });
    }

    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Get league last sync info
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { lastSyncedAt: true },
    });

    return NextResponse.json({
      activities: activities.slice(0, limit),
      pagination: {
        limit,
        offset,
        hasMore: activities.length > limit,
      },
      lastSyncedAt: league?.lastSyncedAt,
    });
  } catch (error) {
    logger.error("Error fetching activity", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
