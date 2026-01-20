import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";
import { syncLeagueWithHistory } from "@/lib/sleeper/sync";

const sleeper = new SleeperClient();

// Only sync leagues matching this name pattern
const TARGET_LEAGUE_NAME = "E Pluribus";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, sleeperId } = body;

    if (!userId || !sleeperId) {
      return NextResponse.json({ error: "userId and sleeperId are required" }, { status: 400 });
    }

    // Start from next year, work backwards to 2023 (when league started on Sleeper)
    const currentYear = new Date().getFullYear();
    const seenIds = new Set<string>();
    let ePluribusLeague: { league_id: string; name: string } | null = null;

    // Check seasons from newest to oldest, looking for the E Pluribus league
    for (let year = currentYear + 1; year >= 2023; year--) {
      try {
        const leagues = await sleeper.getUserLeagues(sleeperId, year);
        for (const league of leagues) {
          // Only consider E Pluribus leagues
          if (league.name?.includes(TARGET_LEAGUE_NAME) && !seenIds.has(league.league_id)) {
            seenIds.add(league.league_id);
            ePluribusLeague = { league_id: league.league_id, name: league.name };
            break;
          }
        }
        // If we found the E Pluribus league, stop searching
        if (ePluribusLeague) break;
      } catch (e) {
        // Ignore errors for individual seasons
        console.log(`No leagues found for season ${year}`);
      }
    }

    if (!ePluribusLeague) {
      return NextResponse.json({
        error: `User is not in the ${TARGET_LEAGUE_NAME} league on Sleeper`,
        leagues: 0
      }, { status: 404 });
    }

    // Sync the E Pluribus league WITH HISTORY (follows previous_league_id chain)
    try {
      const result = await syncLeagueWithHistory(ePluribusLeague.league_id);

      return NextResponse.json({
        success: true,
        league: ePluribusLeague.name,
        seasons: result.seasons.length,
        seasonsList: result.seasons.map(s => s.season),
      });
    } catch (e) {
      return NextResponse.json({
        error: `Failed to sync ${ePluribusLeague.name}: ${e}`,
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error syncing user leagues:", error);
    return NextResponse.json({ error: "Failed to sync user leagues" }, { status: 500 });
  }
}
