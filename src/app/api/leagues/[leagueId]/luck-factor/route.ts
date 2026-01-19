/**
 * Luck Factor API Route
 * GET /api/leagues/[leagueId]/luck-factor - Calculate team luck ratings
 *
 * Luck = Actual Wins - Expected Wins
 * Expected Wins = (Points For Rank) / Total Teams × Games Played
 *
 * Now includes HISTORICAL data across all linked seasons
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface LuckRating {
  rosterId: string;
  sleeperId: string;
  teamName: string;
  owners: string[];
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsForRank: number;
  expectedWins: number;
  actualWins: number;
  luckFactor: number;
  luckRating: "very_lucky" | "lucky" | "neutral" | "unlucky" | "very_unlucky";
  scheduleStrength: number;
  seasonsPlayed: number;
  seasonBreakdown?: Array<{
    season: number;
    wins: number;
    losses: number;
    pointsFor: number;
    luck: number;
  }>;
}

/**
 * Get all league IDs in the chain (current + all previous seasons)
 */
async function getLeagueChain(leagueId: string): Promise<string[]> {
  const leagueIds: string[] = [];
  let currentId: string | null = leagueId;

  while (currentId) {
    const league: { id: string; previousLeagueId: string | null; sleeperId: string } | null =
      await prisma.league.findUnique({
        where: { id: currentId },
        select: { id: true, previousLeagueId: true, sleeperId: true },
      });

    if (!league) break;
    leagueIds.push(league.id);

    // Find league with matching sleeperId as previousLeagueId
    if (league.previousLeagueId && league.previousLeagueId !== "0") {
      const prevLeague: { id: string } | null = await prisma.league.findFirst({
        where: { sleeperId: league.previousLeagueId },
        select: { id: true },
      });
      currentId = prevLeague?.id || null;
    } else {
      currentId = null;
    }
  }

  return leagueIds;
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

    // Get all leagues in the chain (current + previous seasons)
    const leagueIds = await getLeagueChain(leagueId);

    // Fetch all rosters from all seasons
    const allRosters = await prisma.roster.findMany({
      where: { leagueId: { in: leagueIds } },
      include: {
        league: { select: { season: true } },
        teamMembers: {
          include: { user: true },
        },
      },
    });

    if (allRosters.length === 0) {
      return NextResponse.json({ luckRatings: [], error: "No rosters found" });
    }

    // Get current season rosters for team names and owners
    const currentRosters = allRosters.filter((r) => r.leagueId === leagueId);

    // Aggregate stats by sleeperId (consistent across seasons)
    const aggregatedStats: Record<
      string,
      {
        sleeperId: string;
        rosterId: string;
        teamName: string;
        owners: string[];
        totalWins: number;
        totalLosses: number;
        totalPointsFor: number;
        totalPointsAgainst: number;
        seasons: Array<{
          season: number;
          wins: number;
          losses: number;
          pointsFor: number;
        }>;
      }
    > = {};

    for (const roster of allRosters) {
      const key = roster.sleeperId;
      if (!aggregatedStats[key]) {
        // Use current season's team name and owners
        const currentRoster = currentRosters.find(
          (r) => r.sleeperId === roster.sleeperId
        );
        aggregatedStats[key] = {
          sleeperId: roster.sleeperId,
          rosterId: currentRoster?.id || roster.id,
          teamName: currentRoster?.teamName || roster.teamName || "Unnamed Team",
          owners: (currentRoster?.teamMembers || roster.teamMembers).map(
            (tm) => tm.user.displayName || tm.user.sleeperUsername
          ),
          totalWins: 0,
          totalLosses: 0,
          totalPointsFor: 0,
          totalPointsAgainst: 0,
          seasons: [],
        };
      }

      aggregatedStats[key].totalWins += roster.wins;
      aggregatedStats[key].totalLosses += roster.losses;
      aggregatedStats[key].totalPointsFor += Number(roster.pointsFor);
      aggregatedStats[key].totalPointsAgainst += Number(roster.pointsAgainst);
      aggregatedStats[key].seasons.push({
        season: roster.league.season,
        wins: roster.wins,
        losses: roster.losses,
        pointsFor: Number(roster.pointsFor),
      });
    }

    // Sort seasons chronologically
    Object.values(aggregatedStats).forEach((team) => {
      team.seasons.sort((a, b) => a.season - b.season);
    });

    // Calculate luck factor for each team
    const teams = Object.values(aggregatedStats);
    const sortedByPoints = [...teams].sort(
      (a, b) => b.totalPointsFor - a.totalPointsFor
    );

    const avgLeaguePoints =
      teams.reduce((sum, t) => sum + t.totalPointsFor, 0) / teams.length;

    const luckRatings: LuckRating[] = teams.map((team) => {
      const pointsForRank =
        sortedByPoints.findIndex((t) => t.sleeperId === team.sleeperId) + 1;

      const gamesPlayed = team.totalWins + team.totalLosses;
      const expectedWinRate =
        teams.length > 1
          ? (teams.length - pointsForRank) / (teams.length - 1)
          : 0.5;
      const expectedWins = expectedWinRate * gamesPlayed;
      const luckFactor = team.totalWins - expectedWins;

      let luckRating: LuckRating["luckRating"];
      if (luckFactor >= 4) luckRating = "very_lucky";
      else if (luckFactor >= 2) luckRating = "lucky";
      else if (luckFactor > -2) luckRating = "neutral";
      else if (luckFactor > -4) luckRating = "unlucky";
      else luckRating = "very_unlucky";

      const scheduleStrength =
        gamesPlayed > 0 ? team.totalPointsAgainst / gamesPlayed : 0;

      // Calculate per-season luck for breakdown
      const seasonBreakdown = team.seasons.map((s) => {
        const seasonGames = s.wins + s.losses;
        // Simplified per-season luck calculation
        const seasonExpectedWinRate = s.pointsFor / avgLeaguePoints;
        const seasonExpectedWins = seasonExpectedWinRate * seasonGames * 0.5;
        return {
          season: s.season,
          wins: s.wins,
          losses: s.losses,
          pointsFor: Math.round(s.pointsFor),
          luck: Math.round((s.wins - seasonExpectedWins) * 10) / 10,
        };
      });

      return {
        rosterId: team.rosterId,
        sleeperId: team.sleeperId,
        teamName: team.teamName,
        owners: team.owners,
        wins: team.totalWins,
        losses: team.totalLosses,
        pointsFor: Math.round(team.totalPointsFor),
        pointsAgainst: Math.round(team.totalPointsAgainst),
        pointsForRank,
        expectedWins: Math.round(expectedWins * 10) / 10,
        actualWins: team.totalWins,
        luckFactor: Math.round(luckFactor * 10) / 10,
        luckRating,
        scheduleStrength: Math.round(scheduleStrength * 10) / 10,
        seasonsPlayed: team.seasons.length,
        seasonBreakdown,
      };
    });

    // Sort by luck factor (most lucky first)
    luckRatings.sort((a, b) => b.luckFactor - a.luckFactor);

    const luckiestTeam = luckRatings[0];
    const unluckiestTeam = luckRatings[luckRatings.length - 1];
    const totalGames =
      teams.reduce((sum, t) => sum + t.totalWins + t.totalLosses, 0) / 2;
    const gamesPerTeam = totalGames / teams.length;

    const response = NextResponse.json({
      luckRatings,
      leagueStats: {
        totalTeams: teams.length,
        totalSeasons: leagueIds.length,
        gamesPerTeam: Math.round(gamesPerTeam),
        avgLeaguePoints: Math.round(avgLeaguePoints),
        luckiestTeam: luckiestTeam?.teamName,
        unluckiestTeam: unluckiestTeam?.teamName,
      },
      generatedAt: new Date().toISOString(),
    });
    response.headers.set(
      "Cache-Control",
      "private, s-maxage=60, stale-while-revalidate=300"
    );
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
