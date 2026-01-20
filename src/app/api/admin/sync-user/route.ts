import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";
import { syncLeague } from "@/lib/sleeper/sync";

const sleeper = new SleeperClient();

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
    const allLeagues: Array<{ league_id: string; previous_league_id?: string }> = [];

    // Check seasons from newest to oldest, stop once we find leagues
    for (let year = currentYear + 1; year >= 2023; year--) {
      try {
        const leagues = await sleeper.getUserLeagues(sleeperId, year);
        for (const league of leagues) {
          if (!seenIds.has(league.league_id)) {
            seenIds.add(league.league_id);
            allLeagues.push(league);
          }
        }
        // If we found leagues, no need to check older seasons
        // (we'll follow previous_league_id chain instead)
        if (allLeagues.length > 0) break;
      } catch (e) {
        // Ignore errors for individual seasons
        console.log(`No leagues found for season ${year}`);
      }
    }

    if (allLeagues.length === 0) {
      return NextResponse.json({
        error: "No leagues found for this user on Sleeper (checked 2023-present)",
        leagues: 0
      }, { status: 404 });
    }

    // Sync each league
    let syncedCount = 0;
    const errors: string[] = [];

    for (const league of allLeagues) {
      try {
        await syncLeague(league.league_id);
        syncedCount++;
      } catch (e) {
        errors.push(`Failed to sync league ${league.league_id}: ${e}`);
      }
    }

    return NextResponse.json({
      success: true,
      leagues: syncedCount,
      total: allLeagues.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error syncing user leagues:", error);
    return NextResponse.json({ error: "Failed to sync user leagues" }, { status: 500 });
  }
}
