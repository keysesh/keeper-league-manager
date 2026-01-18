/**
 * NFL Schedule API Route
 * GET /api/nflverse/schedule - Get schedule data, bye weeks, SOS
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { syncSchedule } from "@/lib/nflverse/sync";
import { NFLVerseClient } from "@/lib/nflverse/client";

/**
 * GET /api/nflverse/schedule
 * Get schedule data for a season
 *
 * Query params:
 * - season: number (default: current season)
 * - team: string (optional - filter to specific team)
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
    const seasonParam = searchParams.get("season");
    const team = searchParams.get("team");
    const season = seasonParam
      ? parseInt(seasonParam, 10)
      : NFLVerseClient.getCurrentSeason();

    // Validate season
    if (isNaN(season) || season < 2006 || season > new Date().getFullYear() + 1) {
      return NextResponse.json(
        { error: "Invalid season. Must be between 2006 and next year." },
        { status: 400 }
      );
    }

    // Get schedule data
    const scheduleData = await syncSchedule(season);

    if (!scheduleData.success) {
      return NextResponse.json(
        { error: scheduleData.errors[0] || "Failed to fetch schedule" },
        { status: 500 }
      );
    }

    // If filtering by team, return only that team's data
    if (team) {
      const upperTeam = team.toUpperCase();
      return NextResponse.json({
        season: scheduleData.season,
        team: upperTeam,
        schedule: scheduleData.schedules[upperTeam] || null,
        record: scheduleData.records[upperTeam] || null,
        strengthOfSchedule: scheduleData.strengthOfSchedule[upperTeam] || null,
      });
    }

    // Return all data
    return NextResponse.json({
      season: scheduleData.season,
      teamsCount: scheduleData.teamsProcessed,
      gamesCount: scheduleData.gamesProcessed,
      schedules: scheduleData.schedules,
      records: scheduleData.records,
      strengthOfSchedule: scheduleData.strengthOfSchedule,
      // Summary arrays for easy consumption
      byeWeeks: Object.fromEntries(
        Object.entries(scheduleData.schedules).map(([t, s]) => [t, s.byeWeek])
      ),
      sosRankings: Object.values(scheduleData.strengthOfSchedule)
        .sort((a, b) => (a.fullRank || 99) - (b.fullRank || 99))
        .map((s) => ({
          team: s.team,
          sos: s.fullSOS,
          rank: s.fullRank,
        })),
    });
  } catch (error) {
    logger.error("Schedule fetch error", error);
    return NextResponse.json(
      {
        error: "Failed to fetch schedule",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
