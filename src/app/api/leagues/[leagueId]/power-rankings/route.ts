/**
 * Power Rankings API Route
 * GET /api/leagues/[leagueId]/power-rankings - Calculate team power rankings
 *
 * Now includes HISTORICAL record data across all linked seasons
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface PlayerScore {
  id: string;
  fullName: string;
  position: string | null;
  ppg: number;
  age: number | null;
  yearsExp: number | null;
}

interface PositionalStrength {
  position: string;
  score: number;
  players: PlayerScore[];
  grade: string;
}

interface PowerRanking {
  rank: number;
  previousRank: number | null;
  change: number;
  rosterId: string;
  sleeperId: string;
  teamName: string;
  owners: string[];
  overallScore: number;
  grade: string;
  record: {
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
  };
  historicalRecord: {
    totalWins: number;
    totalLosses: number;
    totalPointsFor: number;
    winPct: number;
    seasonsPlayed: number;
    seasonBreakdown: Array<{
      season: number;
      wins: number;
      losses: number;
      pointsFor: number;
    }>;
  };
  positionalStrength: PositionalStrength[];
  keeperValue: number;
  draftCapital: number;
  starPower: number;
  depth: number;
  trajectory: "rising" | "falling" | "stable";
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

// Position weights for scoring
const POSITION_WEIGHTS: Record<string, number> = {
  QB: 0.15,
  RB: 0.30,
  WR: 0.30,
  TE: 0.15,
  K: 0.05,
  DEF: 0.05,
};

// Grade thresholds
function getGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 85) return "A";
  if (score >= 80) return "A-";
  if (score >= 75) return "B+";
  if (score >= 70) return "B";
  if (score >= 65) return "B-";
  if (score >= 60) return "C+";
  if (score >= 55) return "C";
  if (score >= 50) return "C-";
  if (score >= 45) return "D+";
  if (score >= 40) return "D";
  return "F";
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

    // Get all leagues in the chain for historical data
    const leagueIds = await getLeagueChain(leagueId);

    // Fetch historical rosters for record aggregation
    const historicalRosters = await prisma.roster.findMany({
      where: { leagueId: { in: leagueIds } },
      include: {
        league: { select: { season: true } },
      },
    });

    // Aggregate historical stats by sleeperId
    const historicalStats: Record<
      string,
      {
        totalWins: number;
        totalLosses: number;
        totalPointsFor: number;
        seasons: Array<{
          season: number;
          wins: number;
          losses: number;
          pointsFor: number;
        }>;
      }
    > = {};

    for (const roster of historicalRosters) {
      const key = roster.sleeperId;
      if (!historicalStats[key]) {
        historicalStats[key] = {
          totalWins: 0,
          totalLosses: 0,
          totalPointsFor: 0,
          seasons: [],
        };
      }
      historicalStats[key].totalWins += roster.wins;
      historicalStats[key].totalLosses += roster.losses;
      historicalStats[key].totalPointsFor += Number(roster.pointsFor);
      historicalStats[key].seasons.push({
        season: roster.league.season,
        wins: roster.wins,
        losses: roster.losses,
        pointsFor: Number(roster.pointsFor),
      });
    }

    // Sort seasons chronologically
    Object.values(historicalStats).forEach((stats) => {
      stats.seasons.sort((a, b) => a.season - b.season);
    });

    // Fetch current rosters with players, keepers, and draft picks
    const rosters = await prisma.roster.findMany({
      where: { leagueId },
      include: {
        rosterPlayers: {
          include: { player: true },
        },
        teamMembers: {
          include: { user: true },
        },
        keepers: {
          include: { player: true },
        },
        draftPicks: true,
      },
    });

    if (rosters.length === 0) {
      return NextResponse.json({ rankings: [], error: "No rosters found" });
    }

    // Calculate power score for each roster
    const rankings: PowerRanking[] = rosters.map((roster) => {
      const history = historicalStats[roster.sleeperId] || {
        totalWins: roster.wins,
        totalLosses: roster.losses,
        totalPointsFor: Number(roster.pointsFor),
        seasons: [],
      };
      const players = roster.rosterPlayers.map((rp) => ({
        id: rp.player.id,
        fullName: rp.player.fullName,
        position: rp.player.position,
        ppg: rp.player.pointsPerGame || 0,
        age: rp.player.age,
        yearsExp: rp.player.yearsExp,
      }));

      // Group players by position
      const byPosition: Record<string, PlayerScore[]> = {};
      for (const p of players) {
        const pos = p.position || "UNKNOWN";
        if (!byPosition[pos]) byPosition[pos] = [];
        byPosition[pos].push(p);
      }

      // Sort each position by PPG
      for (const pos of Object.keys(byPosition)) {
        byPosition[pos].sort((a, b) => b.ppg - a.ppg);
      }

      // Calculate positional strength scores
      const positionalStrength: PositionalStrength[] = [];
      let totalPositionalScore = 0;

      for (const [pos, weight] of Object.entries(POSITION_WEIGHTS)) {
        const posPlayers = byPosition[pos] || [];

        // Score based on top starters at position
        const starterCount = pos === "RB" || pos === "WR" ? 2 : 1;
        const starters = posPlayers.slice(0, starterCount);
        const avgPPG = starters.length > 0
          ? starters.reduce((sum, p) => sum + p.ppg, 0) / starters.length
          : 0;

        // Normalize PPG to a 0-100 scale (assuming max PPG around 25 for elite players)
        const normalizedScore = Math.min(100, (avgPPG / 20) * 100);
        const weightedScore = normalizedScore * weight;
        totalPositionalScore += weightedScore;

        positionalStrength.push({
          position: pos,
          score: Math.round(normalizedScore),
          players: posPlayers.slice(0, 3),
          grade: getGrade(normalizedScore),
        });
      }

      // Star power - average PPG of top 3 players
      const allPlayersSorted = [...players].sort((a, b) => b.ppg - a.ppg);
      const top3 = allPlayersSorted.slice(0, 3);
      const starPower = top3.length > 0
        ? top3.reduce((sum, p) => sum + p.ppg, 0) / top3.length
        : 0;

      // Depth - average PPG of players 4-10
      const benchPlayers = allPlayersSorted.slice(3, 10);
      const depth = benchPlayers.length > 0
        ? benchPlayers.reduce((sum, p) => sum + p.ppg, 0) / benchPlayers.length
        : 0;

      // Keeper value - sum of keeper cost savings (lower cost = higher value)
      const keeperValue = roster.keepers.reduce((sum, k) => {
        const costSaving = Math.max(0, 8 - k.finalCost); // Assuming round 8 is baseline
        return sum + costSaving;
      }, 0);

      // Draft capital - weighted by round
      const draftCapital = roster.draftPicks.reduce((sum, pick) => {
        const roundValue = Math.max(0, 17 - pick.round); // Round 1 = 16 points, Round 16 = 1 point
        return sum + roundValue;
      }, 0);

      // Calculate overall score (weighted combination)
      const overallScore = Math.round(
        totalPositionalScore * 0.5 + // 50% positional strength
        (starPower / 20) * 100 * 0.2 + // 20% star power
        (depth / 10) * 100 * 0.1 + // 10% depth
        Math.min(100, keeperValue * 5) * 0.1 + // 10% keeper value
        Math.min(100, draftCapital) * 0.1 // 10% draft capital
      );

      // Determine trajectory based on roster age
      const avgAge = players.filter(p => p.age).length > 0
        ? players.filter(p => p.age).reduce((sum, p) => sum + (p.age || 0), 0) / players.filter(p => p.age).length
        : 26;
      const youngStars = players.filter(p => (p.age || 30) < 26 && p.ppg > 10).length;

      let trajectory: "rising" | "falling" | "stable" = "stable";
      if (avgAge < 25.5 || youngStars >= 3) trajectory = "rising";
      else if (avgAge > 28) trajectory = "falling";

      const totalGames = history.totalWins + history.totalLosses;

      return {
        rank: 0, // Will be set after sorting
        previousRank: null,
        change: 0,
        rosterId: roster.id,
        sleeperId: roster.sleeperId,
        teamName: roster.teamName || "Unnamed Team",
        owners: roster.teamMembers.map((tm) => tm.user.displayName || tm.user.sleeperUsername),
        overallScore,
        grade: getGrade(overallScore),
        record: {
          wins: roster.wins,
          losses: roster.losses,
          ties: roster.ties,
          pointsFor: Number(roster.pointsFor),
        },
        historicalRecord: {
          totalWins: history.totalWins,
          totalLosses: history.totalLosses,
          totalPointsFor: Math.round(history.totalPointsFor),
          winPct: totalGames > 0 ? Math.round((history.totalWins / totalGames) * 1000) / 10 : 0,
          seasonsPlayed: history.seasons.length,
          seasonBreakdown: history.seasons.map((s) => ({
            season: s.season,
            wins: s.wins,
            losses: s.losses,
            pointsFor: Math.round(s.pointsFor),
          })),
        },
        positionalStrength,
        keeperValue: Math.round(keeperValue * 10) / 10,
        draftCapital,
        starPower: Math.round(starPower * 10) / 10,
        depth: Math.round(depth * 10) / 10,
        trajectory,
      };
    });

    // Sort by overall score and assign ranks
    rankings.sort((a, b) => b.overallScore - a.overallScore);
    rankings.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    const response = NextResponse.json({
      rankings,
      totalSeasons: leagueIds.length,
      generatedAt: new Date().toISOString(),
      methodology: {
        positionalStrength: "50%",
        starPower: "20%",
        depth: "10%",
        keeperValue: "10%",
        draftCapital: "10%",
      },
    });
    response.headers.set('Cache-Control', 'private, s-maxage=60, stale-while-revalidate=300');
    return response;
  } catch (error) {
    logger.error("Power rankings fetch error", error);
    return NextResponse.json(
      {
        error: "Failed to calculate power rankings",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
