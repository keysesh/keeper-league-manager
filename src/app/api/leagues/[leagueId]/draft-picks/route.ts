import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

/**
 * GET /api/leagues/[leagueId]/draft-picks
 *
 * Returns draft pick ownership for the upcoming draft season.
 * Each team starts with their own picks (Rd 1-5 or whatever rounds exist),
 * then traded picks modify ownership.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the planning season (next year's draft)
    const now = new Date();
    const planningSeason = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();

    // Get all rosters in the league
    const rosters = await prisma.roster.findMany({
      where: { leagueId },
      select: { id: true, sleeperId: true, teamName: true },
    });

    // Get traded picks for this league and season
    const tradedPicks = await prisma.tradedPick.findMany({
      where: {
        leagueId,
        season: planningSeason,
      },
    });

    // Build a map of sleeperId to roster info
    const rosterMap = new Map<string, { id: string; teamName: string | null }>();
    for (const roster of rosters) {
      if (roster.sleeperId) {
        rosterMap.set(roster.sleeperId, { id: roster.id, teamName: roster.teamName });
      }
    }

    // Default to 5 rounds for draft picks
    const maxRounds = 5;

    // Build draft pick ownership for each team
    // Start with each team owning their own picks
    const pickOwnership: {
      season: number;
      round: number;
      originalOwnerSleeperId: string;
      currentOwnerSleeperId: string;
      originalOwnerName: string;
      currentOwnerRosterId: string;
    }[] = [];

    for (const roster of rosters) {
      if (!roster.sleeperId) continue;

      for (let round = 1; round <= maxRounds; round++) {
        // Check if this pick was traded
        const tradedPick = tradedPicks.find(
          tp => tp.originalOwnerId === roster.sleeperId && tp.round === round
        );

        pickOwnership.push({
          season: planningSeason,
          round,
          originalOwnerSleeperId: roster.sleeperId,
          currentOwnerSleeperId: tradedPick?.currentOwnerId || roster.sleeperId,
          originalOwnerName: roster.teamName || `Team ${roster.sleeperId.slice(0, 6)}`,
          currentOwnerRosterId: tradedPick?.currentOwnerId
            ? rosterMap.get(tradedPick.currentOwnerId)?.id || ''
            : roster.id,
        });
      }
    }

    return NextResponse.json({
      season: planningSeason,
      picks: pickOwnership,
      rosters: rosters.map(r => ({
        id: r.id,
        sleeperId: r.sleeperId,
        teamName: r.teamName,
      })),
    });
  } catch (error) {
    console.error("Error fetching draft picks:", error);
    return NextResponse.json({ error: "Failed to fetch draft picks" }, { status: 500 });
  }
}
