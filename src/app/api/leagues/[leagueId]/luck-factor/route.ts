/**
 * Luck Factor API Route
 * GET /api/leagues/[leagueId]/luck-factor - Calculate team luck ratings
 *
 * Luck = Actual Wins - Expected Wins
 * Expected Wins = (Points For Rank) / Total Teams × Games Played
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface LuckRating {
  rosterId: string;
  teamName: string;
  owners: string[];
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsForRank: number;
  expectedWins: number;
  actualWins: number;
  luckFactor: number; // Positive = lucky, Negative = unlucky
  luckRating: "very_lucky" | "lucky" | "neutral" | "unlucky" | "very_unlucky";
  scheduleStrength: number; // Average opponent points
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leagueId } = await params;

    // Fetch all rosters with their records
    const rosters = await prisma.roster.findMany({
      where: { leagueId },
      include: {
        teamMembers: {
          include: { user: true },
        },
      },
      orderBy: { pointsFor: "desc" },
    });

    if (rosters.length === 0) {
      return NextResponse.json({ luckRatings: [], error: "No rosters found" });
    }

    const totalTeams = rosters.length;
    const totalGames = rosters.reduce((sum, r) => sum + r.wins + r.losses, 0) / 2; // Total matchups
    const gamesPerTeam = totalGames / totalTeams;

    // Calculate points for rank (1 = highest points)
    const sortedByPoints = [...rosters].sort(
      (a, b) => Number(b.pointsFor) - Number(a.pointsFor)
    );

    // Calculate average opponent points for schedule strength
    const avgLeaguePoints =
      rosters.reduce((sum, r) => sum + Number(r.pointsFor), 0) / totalTeams;

    const luckRatings: LuckRating[] = rosters.map((roster) => {
      // Find points for rank
      const pointsForRank =
        sortedByPoints.findIndex((r) => r.id === roster.id) + 1;

      // Expected wins formula: better points = more expected wins
      // If you have the best points (rank 1), you'd expect to beat most teams
      // Expected win rate = (totalTeams - pointsForRank) / (totalTeams - 1)
      const expectedWinRate =
        totalTeams > 1 ? (totalTeams - pointsForRank) / (totalTeams - 1) : 0.5;
      const gamesPlayed = roster.wins + roster.losses;
      const expectedWins = expectedWinRate * gamesPlayed;

      // Luck factor = Actual - Expected
      const luckFactor = roster.wins - expectedWins;

      // Luck rating based on deviation
      let luckRating: LuckRating["luckRating"];
      if (luckFactor >= 2) luckRating = "very_lucky";
      else if (luckFactor >= 1) luckRating = "lucky";
      else if (luckFactor > -1) luckRating = "neutral";
      else if (luckFactor > -2) luckRating = "unlucky";
      else luckRating = "very_unlucky";

      // Schedule strength = average opponent points (approximated by points against / games)
      const scheduleStrength =
        gamesPlayed > 0 ? Number(roster.pointsAgainst) / gamesPlayed : 0;

      return {
        rosterId: roster.id,
        teamName: roster.teamName || "Unnamed Team",
        owners: roster.teamMembers.map(
          (tm) => tm.user.displayName || tm.user.sleeperUsername
        ),
        wins: roster.wins,
        losses: roster.losses,
        pointsFor: Number(roster.pointsFor),
        pointsAgainst: Number(roster.pointsAgainst),
        pointsForRank,
        expectedWins: Math.round(expectedWins * 10) / 10,
        actualWins: roster.wins,
        luckFactor: Math.round(luckFactor * 10) / 10,
        luckRating,
        scheduleStrength: Math.round(scheduleStrength * 10) / 10,
      };
    });

    // Sort by luck factor (most lucky first)
    luckRatings.sort((a, b) => b.luckFactor - a.luckFactor);

    // Calculate league stats
    const luckiestTeam = luckRatings[0];
    const unluckiestTeam = luckRatings[luckRatings.length - 1];
    const avgScheduleStrength =
      luckRatings.reduce((sum, r) => sum + r.scheduleStrength, 0) / totalTeams;

    const response = NextResponse.json({
      luckRatings,
      leagueStats: {
        totalTeams,
        gamesPerTeam,
        avgLeaguePoints: Math.round(avgLeaguePoints * 10) / 10,
        avgScheduleStrength: Math.round(avgScheduleStrength * 10) / 10,
        luckiestTeam: luckiestTeam?.teamName,
        unluckiestTeam: unluckiestTeam?.teamName,
      },
      generatedAt: new Date().toISOString(),
    });
    response.headers.set('Cache-Control', 'private, s-maxage=60, stale-while-revalidate=300');
    return response;
  } catch (error) {
    logger.error("Luck factor fetch error", error);
    return NextResponse.json(
      {
        error: "Failed to calculate luck factors",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
