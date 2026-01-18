/**
 * Trending Players API Route
 * GET /api/players/trending - Get trending adds/drops from Sleeper
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sleeperClient } from "@/lib/sleeper/client";
import { logger } from "@/lib/logger";

interface TrendingPlayerResponse {
  sleeperId: string;
  count: number;
  fullName: string;
  position: string;
  team: string | null;
  fantasyPointsPpr: number | null;
  pointsPerGame: number | null;
  gamesPlayed: number | null;
}

/**
 * GET /api/players/trending
 * Get trending players (adds or drops) from Sleeper
 *
 * Query params:
 * - type: "add" | "drop" (default: "add")
 * - hours: number (lookback hours, default: 24)
 * - limit: number (max results, default: 25, max: 50)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const type = (searchParams.get("type") || "add") as "add" | "drop";
    const hours = Math.min(Math.max(parseInt(searchParams.get("hours") || "24", 10), 1), 168); // 1-168 hours
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "25", 10), 1), 50); // 1-50 players

    // Validate type
    if (type !== "add" && type !== "drop") {
      return NextResponse.json(
        { error: "Invalid type. Must be 'add' or 'drop'." },
        { status: 400 }
      );
    }

    // Fetch trending players from Sleeper
    const trendingData = await sleeperClient.getTrendingPlayers(type, hours, limit);

    if (!trendingData || trendingData.length === 0) {
      return NextResponse.json({
        type,
        lookbackHours: hours,
        players: [],
      });
    }

    // Get player IDs
    const sleeperIds = trendingData.map((t) => t.player_id);

    // Fetch player details from our database
    const dbPlayers = await prisma.player.findMany({
      where: {
        sleeperId: { in: sleeperIds },
      },
      select: {
        sleeperId: true,
        fullName: true,
        position: true,
        team: true,
        fantasyPointsPpr: true,
        pointsPerGame: true,
        gamesPlayed: true,
      },
    });

    // Build lookup map
    const playerMap = new Map(dbPlayers.map((p) => [p.sleeperId, p]));

    // Enrich trending data with player info
    const enrichedPlayers: TrendingPlayerResponse[] = trendingData
      .map((trending) => {
        const player = playerMap.get(trending.player_id);
        if (!player) {
          return null; // Skip players not in our DB
        }
        return {
          sleeperId: trending.player_id,
          count: trending.count,
          fullName: player.fullName,
          position: player.position,
          team: player.team,
          fantasyPointsPpr: player.fantasyPointsPpr,
          pointsPerGame: player.pointsPerGame,
          gamesPlayed: player.gamesPlayed,
        };
      })
      .filter((p): p is TrendingPlayerResponse => p !== null);

    return NextResponse.json({
      type,
      lookbackHours: hours,
      players: enrichedPlayers,
      // Include raw count for players not in our DB
      totalTrending: trendingData.length,
      enrichedCount: enrichedPlayers.length,
    });
  } catch (error) {
    logger.error("Trending players fetch error", error);
    return NextResponse.json(
      {
        error: "Failed to fetch trending players",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
