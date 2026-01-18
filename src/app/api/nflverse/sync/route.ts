/**
 * NFLverse Sync API Route
 * POST /api/nflverse/sync - Sync NFLverse data (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  syncNFLVerseData,
  syncNFLVerseIdMappings,
  syncNFLVerseStats,
  syncNFLVerseProjections,
} from "@/lib/nflverse/sync";
import { NFLVerseClient } from "@/lib/nflverse/client";
import {
  checkRateLimit,
  createRateLimitResponse,
  addRateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/rate-limit";

/**
 * POST /api/nflverse/sync
 * Sync NFLverse data to database
 *
 * Query params:
 * - type: "all" | "ids" | "stats" (default: "all")
 * - season: number (default: current season)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Apply strict rate limiting for this heavy operation
    const rateLimit = await checkRateLimit(session.user.id, RATE_LIMITS.nflverseSync);
    if (!rateLimit.success) {
      return createRateLimitResponse(
        rateLimit.remaining,
        rateLimit.reset,
        rateLimit.limit
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "all";
    const seasonParam = searchParams.get("season");
    const season = seasonParam
      ? parseInt(seasonParam, 10)
      : NFLVerseClient.getCurrentSeason();

    // Validate season
    if (isNaN(season) || season < 2020 || season > new Date().getFullYear()) {
      return NextResponse.json(
        { error: "Invalid season. Must be between 2020 and current year." },
        { status: 400 }
      );
    }

    // Run appropriate sync
    let result;
    switch (type) {
      case "ids":
        result = { idMapping: await syncNFLVerseIdMappings(season) };
        break;
      case "stats":
        result = { stats: await syncNFLVerseStats(season) };
        break;
      case "projections":
        result = { projections: await syncNFLVerseProjections(season) };
        break;
      case "all":
      default:
        result = await syncNFLVerseData(season);
        break;
    }

    const response = NextResponse.json({
      success: true,
      season,
      type,
      result,
    });
    return addRateLimitHeaders(
      response,
      rateLimit.remaining,
      rateLimit.reset,
      rateLimit.limit
    );
  } catch (error) {
    logger.error("NFLverse sync error", error);
    return NextResponse.json(
      {
        error: "Sync failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/nflverse/sync
 * Get sync status/info
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Count players with NFLverse data
    // Use raw query since Prisma's JSON filtering is complex
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM players
      WHERE metadata->'nflverse'->>'gsisId' IS NOT NULL
    `;
    const playersWithNFLverse = Number(result[0]?.count || 0);

    const totalPlayers = await prisma.player.count();

    return NextResponse.json({
      currentSeason: NFLVerseClient.getCurrentSeason(),
      playersWithNFLverse,
      totalPlayers,
      coverage: totalPlayers > 0 ? (playersWithNFLverse / totalPlayers) * 100 : 0,
    });
  } catch (error) {
    logger.error("NFLverse status error", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}
