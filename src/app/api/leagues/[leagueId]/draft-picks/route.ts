import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

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

    // Get max rounds from latest draft or default to 16
    const latestDraft = await prisma.draft.findFirst({
      where: { leagueId },
      orderBy: { season: 'desc' },
      select: { rounds: true },
    });
    const maxRounds = latestDraft?.rounds || 16;

    // Build a map of sleeperId -> teamName for display
    const sleeperToName = new Map<string, string>();
    for (const roster of rosters) {
      if (roster.sleeperId) {
        sleeperToName.set(roster.sleeperId, roster.teamName || `Team ${roster.sleeperId.slice(0, 6)}`);
      }
    }

    // Build draft pick ownership for each team
    // Each team starts with their own Rd 1-5, then we apply trades
    const pickOwnership: {
      season: number;
      round: number;
      originalOwnerSleeperId: string;
      currentOwnerSleeperId: string;
      originalOwnerName: string;
      currentOwnerRosterId: string;
    }[] = [];

    // For each team, calculate their picks:
    // 1. Their own picks that weren't traded away
    // 2. Picks they acquired from other teams
    for (const roster of rosters) {
      if (!roster.sleeperId) continue;

      // Check each round
      for (let round = 1; round <= maxRounds; round++) {
        // Did this team trade AWAY their own pick in this round?
        const tradedAway = tradedPicks.find(
          tp => tp.originalOwnerId === roster.sleeperId &&
                tp.round === round &&
                tp.currentOwnerId !== roster.sleeperId
        );

        // If they still own their original pick, add it
        if (!tradedAway) {
          pickOwnership.push({
            season: planningSeason,
            round,
            originalOwnerSleeperId: roster.sleeperId,
            currentOwnerSleeperId: roster.sleeperId,
            originalOwnerName: roster.teamName || `Team ${roster.sleeperId.slice(0, 6)}`,
            currentOwnerRosterId: roster.id,
          });
        }
      }

      // Find picks this team ACQUIRED from others
      const acquiredPicks = tradedPicks.filter(
        tp => tp.currentOwnerId === roster.sleeperId &&
              tp.originalOwnerId !== roster.sleeperId
      );

      for (const acquired of acquiredPicks) {
        pickOwnership.push({
          season: planningSeason,
          round: acquired.round,
          originalOwnerSleeperId: acquired.originalOwnerId,
          currentOwnerSleeperId: roster.sleeperId,
          originalOwnerName: sleeperToName.get(acquired.originalOwnerId) || `Team ${acquired.originalOwnerId.slice(0, 6)}`,
          currentOwnerRosterId: roster.id,
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
    logger.error("Error fetching draft picks", error);
    return NextResponse.json({ error: "Failed to fetch draft picks" }, { status: 500 });
  }
}
