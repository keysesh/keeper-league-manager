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
import { getLeagueChain } from "@/lib/services/league-chain";

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
  ownerAvatar: string | null;
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
  winRate: number;
  draftCapital: number;
  starPower: number;
  depth: number;
  // Raw values for tooltips
  rawStarPower: number;
  rawDepth: number;
  rawDraftCapital: number;
  trajectory: "rising" | "falling" | "stable";
  luckFactor: number;
  luckRating: "lucky" | "unlucky" | "neutral";
  topScorer: {
    playerName: string;
    position: string | null;
    ppg: number;
  } | null;
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
          include: {
            user: {
              select: {
                displayName: true,
                sleeperUsername: true,
                avatar: true,
                sleeperId: true,
              },
            },
          },
        },
        keepers: {
          include: { player: true },
        },
        draftPicks: true,
      },
    });

    // Calculate expected wins for luck factor using all rosters
    // Based on All-Play record: how many teams would you beat each week
    const allPointsFor = rosters.map(r => Number(r.pointsFor)).sort((a, b) => a - b);
    const calculateExpectedWins = (pointsFor: number, totalGames: number): number => {
      if (totalGames === 0) return 0;
      const maxPoints = Math.max(...allPointsFor, 1);
      const minPoints = Math.min(...allPointsFor);

      // Linear interpolation based on points position
      const range = maxPoints - minPoints || 1;
      const expectedWinPct = Math.min(0.9, Math.max(0.1, (pointsFor - minPoints) / range));
      return expectedWinPct * totalGames;
    };

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

      // Draft capital - weighted by round
      const draftCapital = roster.draftPicks.reduce((sum, pick) => {
        const roundValue = Math.max(0, 17 - pick.round); // Round 1 = 16 points, Round 16 = 1 point
        return sum + roundValue;
      }, 0);

      // Win rate from historical record (will be normalized to percentile later)
      const totalGamesPlayed = history.totalWins + history.totalLosses;
      const rawWinPct = totalGamesPlayed > 0
        ? (history.totalWins / totalGamesPlayed) * 100
        : 50; // Default to 50% if no games

      // Calculate overall score (weighted combination)
      // Note: winRate will be normalized to percentile later, using rawWinPct here
      const overallScore = Math.round(
        totalPositionalScore * 0.5 + // 50% positional strength
        (starPower / 20) * 100 * 0.2 + // 20% star power
        (depth / 10) * 100 * 0.1 + // 10% depth
        rawWinPct * 0.1 + // 10% win rate
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

      // Calculate luck factor
      const currentTotalGames = roster.wins + roster.losses;
      const expectedWins = calculateExpectedWins(Number(roster.pointsFor), currentTotalGames);
      const luckFactor = Math.round((roster.wins - expectedWins) * 10) / 10;
      const luckRating: "lucky" | "unlucky" | "neutral" =
        luckFactor > 1 ? "lucky" : luckFactor < -1 ? "unlucky" : "neutral";

      // Get owner avatar (use first team member's avatar)
      const primaryOwner = roster.teamMembers[0]?.user;
      const ownerAvatar = primaryOwner?.avatar || primaryOwner?.sleeperId || null;

      // Get top scorer
      const topPlayer = allPlayersSorted[0];
      const topScorer = topPlayer && topPlayer.ppg > 0 ? {
        playerName: topPlayer.fullName,
        position: topPlayer.position,
        ppg: Math.round(topPlayer.ppg * 10) / 10,
      } : null;

      return {
        rank: 0, // Will be set after sorting
        previousRank: null,
        change: 0,
        rosterId: roster.id,
        sleeperId: roster.sleeperId,
        teamName: roster.teamName || "Unnamed Team",
        owners: roster.teamMembers.map((tm) => tm.user.displayName || tm.user.sleeperUsername),
        ownerAvatar,
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
        winRate: Math.round(rawWinPct * 10) / 10, // Will be normalized to percentile later
        draftCapital,
        starPower: Math.round(starPower * 10) / 10,
        depth: Math.round(depth * 10) / 10,
        // Raw values for tooltips
        rawStarPower: Math.round(starPower * 10) / 10,
        rawDepth: Math.round(depth * 10) / 10,
        rawDraftCapital: draftCapital,
        trajectory,
        luckFactor,
        luckRating,
        topScorer,
      };
    });

    // Sort by overall score and assign ranks
    rankings.sort((a, b) => b.overallScore - a.overallScore);
    rankings.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    // Normalize stats to percentiles (0-100 relative to league)
    const normalizeToPercentile = (values: number[]): number[] => {
      const sorted = [...values].sort((a, b) => a - b);
      return values.map(v => {
        const rank = sorted.filter(s => s < v).length;
        return Math.round((rank / Math.max(sorted.length - 1, 1)) * 100);
      });
    };

    const starPowers = rankings.map(r => r.starPower);
    const depths = rankings.map(r => r.depth);
    const winRates = rankings.map(r => r.winRate);
    const draftCapitals = rankings.map(r => r.draftCapital);

    const normalizedStarPower = normalizeToPercentile(starPowers);
    const normalizedDepth = normalizeToPercentile(depths);
    const normalizedWinRate = normalizeToPercentile(winRates);
    const normalizedDraftCapital = normalizeToPercentile(draftCapitals);

    // Update rankings with normalized values (raw values preserved for tooltips)
    rankings.forEach((r, idx) => {
      r.starPower = normalizedStarPower[idx];
      r.depth = normalizedDepth[idx];
      r.winRate = normalizedWinRate[idx];
      r.draftCapital = normalizedDraftCapital[idx];
    });

    const response = NextResponse.json({
      rankings,
      totalSeasons: leagueIds.length,
      generatedAt: new Date().toISOString(),
      methodology: {
        positionalStrength: "50%",
        starPower: "20%",
        depth: "10%",
        winRate: "10%",
        draftCapital: "10%",
      },
    });
    response.headers.set('Cache-Control', 'private, s-maxage=300, stale-while-revalidate=600');
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
