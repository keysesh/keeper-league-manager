/**
 * Top Scorers API Route
 * GET /api/players/top-scorers - Get top scoring players by position
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface TopScorerResponse {
  id: string;
  sleeperId: string;
  fullName: string;
  position: string | null;
  team: string | null;
  age: number | null;
  yearsExp: number | null;
  fantasyPointsPpr: number | null;
  pointsPerGame: number | null;
  gamesPlayed: number | null;
  rank: number;
}

/**
 * GET /api/players/top-scorers
 * Get top scoring players, optionally filtered by position
 *
 * Query params:
 * - position: "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "all" (default: "all")
 * - limit: number (max results per position, default: 10, max: 25)
 * - minGames: number (minimum games played, default: 6)
 * - sortBy: "total" | "ppg" (default: "ppg")
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
    const position = searchParams.get("position") || "all";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10", 10), 1), 25);
    const minGames = Math.max(parseInt(searchParams.get("minGames") || "6", 10), 1);
    const sortBy = (searchParams.get("sortBy") || "ppg") as "total" | "ppg";

    const validPositions = ["QB", "RB", "WR", "TE", "K", "DEF"];

    // Build query
    const where = {
      gamesPlayed: { gte: minGames },
      fantasyPointsPpr: { gt: 0 },
      ...(position !== "all" && validPositions.includes(position.toUpperCase())
        ? { position: position.toUpperCase() }
        : { position: { in: validPositions } }),
    };

    const orderBy = sortBy === "ppg"
      ? { pointsPerGame: "desc" as const }
      : { fantasyPointsPpr: "desc" as const };

    if (position === "all") {
      // Get top scorers for each position
      const results: Record<string, TopScorerResponse[]> = {};

      for (const pos of ["QB", "RB", "WR", "TE"]) {
        const players = await prisma.player.findMany({
          where: {
            ...where,
            position: pos,
          },
          orderBy,
          take: limit,
          select: {
            id: true,
            sleeperId: true,
            fullName: true,
            position: true,
            team: true,
            age: true,
            yearsExp: true,
            fantasyPointsPpr: true,
            pointsPerGame: true,
            gamesPlayed: true,
          },
        });

        results[pos] = players.map((p, idx) => ({
          ...p,
          rank: idx + 1,
        }));
      }

      return NextResponse.json({
        sortBy,
        minGames,
        byPosition: results,
      });
    } else {
      // Get top scorers for specific position
      const players = await prisma.player.findMany({
        where,
        orderBy,
        take: limit,
        select: {
          id: true,
          sleeperId: true,
          fullName: true,
          position: true,
          team: true,
          age: true,
          yearsExp: true,
          fantasyPointsPpr: true,
          pointsPerGame: true,
          gamesPlayed: true,
        },
      });

      const rankedPlayers: TopScorerResponse[] = players.map((p, idx) => ({
        ...p,
        rank: idx + 1,
      }));

      return NextResponse.json({
        position: position.toUpperCase(),
        sortBy,
        minGames,
        players: rankedPlayers,
      });
    }
  } catch (error) {
    logger.error("Top scorers fetch error", error);
    return NextResponse.json(
      {
        error: "Failed to fetch top scorers",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
