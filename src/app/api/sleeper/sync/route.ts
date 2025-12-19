import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncLeague, syncUserLeagues, quickSyncLeague } from "@/lib/sleeper/sync";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";

// Extend timeout for sync operations (requires Vercel Pro for >10s)
export const maxDuration = 60;

/**
 * POST /api/sleeper/sync
 * Sync league data from Sleeper
 *
 * Body options:
 * - { action: "league", leagueId: string } - Sync a specific league
 * - { action: "user-leagues" } - Sync all leagues for the authenticated user
 * - { action: "quick", leagueId: string } - Quick sync (rosters only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, leagueId, sleeperLeagueId } = body;

    switch (action) {
      case "league": {
        // Sync a specific league by Sleeper ID
        if (!sleeperLeagueId) {
          return NextResponse.json(
            { error: "sleeperLeagueId is required" },
            { status: 400 }
          );
        }

        const result = await syncLeague(sleeperLeagueId);
        return NextResponse.json({
          success: true,
          message: `Synced league: ${result.league.name}`,
          data: result,
        });
      }

      case "user-leagues": {
        // Sync all leagues for the current user
        const season = getCurrentSeason();
        const result = await syncUserLeagues(session.user.id, season);

        return NextResponse.json({
          success: true,
          message: `Synced ${result.leagues.length} leagues`,
          data: result,
        });
      }

      case "quick": {
        // Quick sync - just update rosters
        if (!leagueId) {
          return NextResponse.json(
            { error: "leagueId is required for quick sync" },
            { status: 400 }
          );
        }

        // Verify user has access to this league
        const roster = await prisma.roster.findFirst({
          where: {
            leagueId,
            teamMembers: {
              some: { userId: session.user.id },
            },
          },
        });

        if (!roster) {
          return NextResponse.json(
            { error: "You don't have access to this league" },
            { status: 403 }
          );
        }

        const result = await quickSyncLeague(leagueId);
        return NextResponse.json({
          success: true,
          message: "Quick sync complete",
          data: result,
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Use 'league', 'user-leagues', or 'quick'" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sleeper/sync
 * Get sync status for a league
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get("leagueId");

    if (!leagueId) {
      return NextResponse.json(
        { error: "leagueId is required" },
        { status: 400 }
      );
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        name: true,
        lastSyncedAt: true,
        rosters: {
          select: { id: true },
        },
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      leagueId: league.id,
      name: league.name,
      lastSyncedAt: league.lastSyncedAt,
      rosterCount: league.rosters.length,
      needsSync: !league.lastSyncedAt ||
        (new Date().getTime() - league.lastSyncedAt.getTime()) > 3600000, // 1 hour
    });
  } catch (error) {
    console.error("Error getting sync status:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}
