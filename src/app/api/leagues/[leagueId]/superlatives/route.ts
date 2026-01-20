/**
 * Superlatives API Route
 * GET /api/leagues/[leagueId]/superlatives - Get league-wide and team-specific superlatives
 *
 * Returns historical achievements like:
 * - Most Trades (lifetime)
 * - Highest Single-Game Score (would need matchup data)
 * - Best Regular Season Record
 * - Most Playoff Appearances
 * - Trade Master badge eligibility
 * - Waiver Hawk badge eligibility
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { SleeperClient } from "@/lib/sleeper/client";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

const sleeper = new SleeperClient();

/**
 * Discover historical leagues by following the previous_league_id chain
 */
async function discoverHistoricalLeagues(
  currentSleeperLeagueId: string,
  maxDepth = 10
): Promise<{ season: number; sleeperLeagueId: string }[]> {
  const historicalLeagues: { season: number; sleeperLeagueId: string }[] = [];
  let currentId: string | null = currentSleeperLeagueId;
  let depth = 0;

  // First, get the current league to find its previous_league_id
  try {
    const currentLeague = await sleeper.getLeague(currentId);
    currentId = currentLeague.previous_league_id || null;
  } catch (error) {
    logger.warn("Failed to get current league for history chain", { error });
    return historicalLeagues;
  }

  // Follow the chain backwards
  while (currentId && depth < maxDepth) {
    try {
      const leagueData = await sleeper.getLeague(currentId);
      historicalLeagues.push({
        season: parseInt(leagueData.season, 10),
        sleeperLeagueId: currentId,
      });
      currentId = leagueData.previous_league_id || null;
      depth++;
    } catch (error) {
      logger.warn(`Failed to fetch historical league ${currentId}`, { error });
      break;
    }
  }

  return historicalLeagues;
}

interface TeamSuperlative {
  rosterId: string;
  teamName: string | null;
  value: number;
  season?: number;
  detail?: string;
}

// Badge tier types
type SeasonsTier = 'veteran' | 'regular' | 'newcomer';
type TradesTier = 'master' | 'dealer' | 'active' | 'first' | null;
type ScoringTier = 'elite' | 'prolific' | 'scorer' | null;
type WinsTier = 'dominant' | 'winner' | 'competitor' | 'club500' | null;
type PlayoffsTier = 'king' | 'regular' | 'contender' | null;

interface TieredBadges {
  seasons: SeasonsTier;
  trades: TradesTier;
  scoring: ScoringTier;
  wins: WinsTier;
  playoffs: PlayoffsTier;
}

interface TeamRankings {
  byWins: number;
  byPoints: number;
  byWinPct: number;
  totalTeams: number;
}

interface SuperlativesResponse {
  leagueSuperlatives: {
    mostTrades: TeamSuperlative | null;
    bestRecord: TeamSuperlative | null;
    mostPoints: TeamSuperlative | null;
    mostPlayoffAppearances: TeamSuperlative | null;
    mostChampionships: TeamSuperlative | null;
  };
  teamSuperlatives: Record<string, {
    totalTrades: number;
    bestSeason: { season: number; wins: number; losses: number; points: number } | null;
    totalPoints: number;
    playoffAppearances: number;
    championships: number;
    isTradeMaster: boolean;
    isWaiverHawk: boolean;
    allTimeRecord: { wins: number; losses: number } | null;
    seasonsPlayed: number;
    // NEW: All-time rankings
    rankings: TeamRankings | null;
    // NEW: Tiered badges
    badges: TieredBadges | null;
  }>;
  badges: {
    tradeMasters: string[];  // roster IDs of top 3 traders
    waiverHawks: string[];   // roster IDs of top 3 waiver users (placeholder)
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leagueId } = await params;
    // Optional rosterId filter available via: searchParams.get("rosterId")

    // Get league with rosters
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        rosters: {
          select: {
            id: true,
            teamName: true,
            sleeperId: true,
            ownerId: true,  // The Sleeper user ID (owner_id)
          },
        },
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const rosterMap = new Map(league.rosters.map(r => [r.id, r]));
    // Note: This map will be rebuilt after fetching current Sleeper rosters
    // to properly map owner_id -> current DB roster ID
    const sleeperIdToRosterId = new Map(league.rosters.map(r => [r.sleeperId, r.id]));

    // Count trades per team from Transaction model
    const tradeTransactions = await prisma.transaction.findMany({
      where: {
        leagueId,
        type: "TRADE",
      },
      include: {
        players: {
          select: {
            fromRosterId: true,
            toRosterId: true,
          },
        },
      },
    });

    // Count trades per roster
    const tradeCountMap = new Map<string, number>();
    for (const tx of tradeTransactions) {
      const involvedRosters = new Set<string>();
      for (const player of tx.players) {
        if (player.fromRosterId) involvedRosters.add(player.fromRosterId);
        if (player.toRosterId) involvedRosters.add(player.toRosterId);
      }
      for (const rid of involvedRosters) {
        tradeCountMap.set(rid, (tradeCountMap.get(rid) || 0) + 1);
      }
    }

    // Also count from TradeProposal model
    const acceptedProposals = await prisma.tradeProposal.findMany({
      where: {
        leagueId,
        status: "ACCEPTED",
      },
      include: {
        parties: {
          select: { rosterId: true },
        },
      },
    });

    for (const proposal of acceptedProposals) {
      for (const party of proposal.parties) {
        tradeCountMap.set(party.rosterId, (tradeCountMap.get(party.rosterId) || 0) + 1);
      }
    }

    // Dynamically discover historical leagues by following the previous_league_id chain
    const historicalLeagues = await discoverHistoricalLeagues(league.sleeperId);

    // Aggregate owner stats
    const ownerStats = new Map<string, {
      ownerId: string;
      rosterId: string | null;
      teamName: string | null;
      totalWins: number;
      totalLosses: number;
      totalPoints: number;
      bestSeason: { season: number; wins: number; losses: number; points: number } | null;
      playoffAppearances: number;
      championships: number;
      seasonsPlayed: number;
    }>();

    // Fetch current season data
    const [currentSleeperRosters, currentWinnersBracket] = await Promise.all([
      sleeper.getRosters(league.sleeperId),
      sleeper.getWinnersBracket(league.sleeperId),
    ]);

    // Build owner_id -> DB roster ID map from current Sleeper rosters
    // This properly maps Sleeper user IDs to our DB roster IDs for historical data aggregation
    const ownerToCurrentRosterId = new Map<string, string>();
    for (const sleeperRoster of currentSleeperRosters) {
      if (sleeperRoster.owner_id) {
        // Find DB roster by ownerId (the Sleeper user ID stored in our DB)
        let dbRoster = league.rosters.find(r => r.ownerId === sleeperRoster.owner_id);

        // Fallback: try matching by sleeperId as roster_id
        if (!dbRoster) {
          dbRoster = league.rosters.find(r => r.sleeperId === String(sleeperRoster.roster_id));
        }

        if (dbRoster) {
          ownerToCurrentRosterId.set(sleeperRoster.owner_id, dbRoster.id);
        }
      }
    }

    // Helper to determine if champion
    function isChampion(bracket: Array<{ p?: number; w?: number }>, rosterSlotId: number): boolean {
      return bracket.some(m => m.p === 1 && m.w === rosterSlotId);
    }

    // Helper to check playoff appearance
    function isInPlayoffs(bracket: Array<{ p?: number; w?: number; l?: number }>, rosterSlotId: number): boolean {
      return bracket.some(m => m.w === rosterSlotId || m.l === rosterSlotId);
    }

    // Process current season
    for (const roster of currentSleeperRosters) {
      if (!roster.owner_id) continue;

      const dbRosterId = ownerToCurrentRosterId.get(roster.owner_id);
      const wins = roster.settings?.wins || 0;
      const losses = roster.settings?.losses || 0;
      const points = roster.settings?.fpts || 0;
      const inPlayoffs = isInPlayoffs(currentWinnersBracket, roster.roster_id);
      const champion = isChampion(currentWinnersBracket, roster.roster_id);

      const existing = ownerStats.get(roster.owner_id);
      const currentSeason = {
        season: league.season,
        wins,
        losses,
        points,
      };

      if (existing) {
        existing.totalWins += wins;
        existing.totalLosses += losses;
        existing.totalPoints += points;
        existing.seasonsPlayed++;
        if (inPlayoffs) existing.playoffAppearances++;
        if (champion) existing.championships++;
        if (!existing.bestSeason || wins > existing.bestSeason.wins ||
            (wins === existing.bestSeason.wins && points > existing.bestSeason.points)) {
          existing.bestSeason = currentSeason;
        }
      } else {
        ownerStats.set(roster.owner_id, {
          ownerId: roster.owner_id,
          rosterId: dbRosterId || null,
          teamName: rosterMap.get(dbRosterId || "")?.teamName || null,
          totalWins: wins,
          totalLosses: losses,
          totalPoints: points,
          bestSeason: currentSeason,
          playoffAppearances: inPlayoffs ? 1 : 0,
          championships: champion ? 1 : 0,
          seasonsPlayed: 1,
        });
      }
    }

    // Process historical seasons
    for (const historicalLeague of historicalLeagues) {
      try {
        const [histRosters, histWinnersBracket] = await Promise.all([
          sleeper.getRosters(historicalLeague.sleeperLeagueId),
          sleeper.getWinnersBracket(historicalLeague.sleeperLeagueId),
        ]);

        for (const roster of histRosters) {
          if (!roster.owner_id) continue;

          const dbRosterId = ownerToCurrentRosterId.get(roster.owner_id);
          const wins = roster.settings?.wins || 0;
          const losses = roster.settings?.losses || 0;
          const points = roster.settings?.fpts || 0;
          const inPlayoffs = isInPlayoffs(histWinnersBracket, roster.roster_id);
          const champion = isChampion(histWinnersBracket, roster.roster_id);

          const historicalSeason = {
            season: historicalLeague.season,
            wins,
            losses,
            points,
          };

          const existing = ownerStats.get(roster.owner_id);
          if (existing) {
            existing.totalWins += wins;
            existing.totalLosses += losses;
            existing.totalPoints += points;
            existing.seasonsPlayed++;
            if (inPlayoffs) existing.playoffAppearances++;
            if (champion) existing.championships++;
            if (!existing.bestSeason || wins > existing.bestSeason.wins ||
                (wins === existing.bestSeason.wins && points > existing.bestSeason.points)) {
              existing.bestSeason = historicalSeason;
            }
          } else {
            ownerStats.set(roster.owner_id, {
              ownerId: roster.owner_id,
              rosterId: dbRosterId || null,
              teamName: rosterMap.get(dbRosterId || "")?.teamName || null,
              totalWins: wins,
              totalLosses: losses,
              totalPoints: points,
              bestSeason: historicalSeason,
              playoffAppearances: inPlayoffs ? 1 : 0,
              championships: champion ? 1 : 0,
              seasonsPlayed: 1,
            });
          }
        }
      } catch (error) {
        logger.warn(`Error fetching historical league ${historicalLeague.sleeperLeagueId}`, { error });
      }
    }

    // Calculate league superlatives
    let mostTrades: TeamSuperlative | null = null;
    let bestRecord: TeamSuperlative | null = null;
    let mostPoints: TeamSuperlative | null = null;
    let mostPlayoffAppearances: TeamSuperlative | null = null;
    let mostChampionships: TeamSuperlative | null = null;

    // Most trades
    let maxTrades = 0;
    for (const [rid, count] of tradeCountMap) {
      if (count > maxTrades) {
        maxTrades = count;
        const roster = rosterMap.get(rid);
        mostTrades = {
          rosterId: rid,
          teamName: roster?.teamName || null,
          value: count,
        };
      }
    }

    // Best record (most wins)
    for (const stats of ownerStats.values()) {
      if (!stats.rosterId) continue;

      if (!bestRecord || stats.totalWins > bestRecord.value) {
        bestRecord = {
          rosterId: stats.rosterId,
          teamName: stats.teamName,
          value: stats.totalWins,
          detail: `${stats.totalWins}-${stats.totalLosses}`,
        };
      }

      if (!mostPoints || stats.totalPoints > mostPoints.value) {
        mostPoints = {
          rosterId: stats.rosterId,
          teamName: stats.teamName,
          value: Math.round(stats.totalPoints),
        };
      }

      if (!mostPlayoffAppearances || stats.playoffAppearances > mostPlayoffAppearances.value) {
        mostPlayoffAppearances = {
          rosterId: stats.rosterId,
          teamName: stats.teamName,
          value: stats.playoffAppearances,
        };
      }

      if (!mostChampionships || stats.championships > mostChampionships.value) {
        mostChampionships = {
          rosterId: stats.rosterId,
          teamName: stats.teamName,
          value: stats.championships,
        };
      }
    }

    // Determine trade masters (top 3 traders)
    const sortedByTrades = Array.from(tradeCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([rid]) => rid);

    // Prepare data for rankings calculations
    const teamStatsForRanking: Array<{
      rosterId: string;
      wins: number;
      losses: number;
      points: number;
      winPct: number;
      seasonsPlayed: number;
      playoffAppearances: number;
      championships: number;
    }> = [];

    for (const roster of league.rosters) {
      const stats = [...ownerStats.values()].find(s => s.rosterId === roster.id) || null;
      if (stats) {
        const totalGames = stats.totalWins + stats.totalLosses;
        teamStatsForRanking.push({
          rosterId: roster.id,
          wins: stats.totalWins,
          losses: stats.totalLosses,
          points: stats.totalPoints,
          winPct: totalGames > 0 ? stats.totalWins / totalGames : 0,
          seasonsPlayed: stats.seasonsPlayed,
          playoffAppearances: stats.playoffAppearances,
          championships: stats.championships,
        });
      }
    }

    // Sort for rankings
    const sortedByWins = [...teamStatsForRanking].sort((a, b) => b.wins - a.wins);
    const sortedByPoints = [...teamStatsForRanking].sort((a, b) => b.points - a.points);
    const sortedByWinPct = [...teamStatsForRanking].sort((a, b) => b.winPct - a.winPct);

    // Find most playoff appearances for "playoff king" badge
    const maxPlayoffAppearances = Math.max(...teamStatsForRanking.map(t => t.playoffAppearances), 0);

    // Helper to get ranking position
    function getRanking(rosterId: string): TeamRankings | null {
      const byWinsIdx = sortedByWins.findIndex(t => t.rosterId === rosterId);
      const byPointsIdx = sortedByPoints.findIndex(t => t.rosterId === rosterId);
      const byWinPctIdx = sortedByWinPct.findIndex(t => t.rosterId === rosterId);

      if (byWinsIdx === -1) return null;

      return {
        byWins: byWinsIdx + 1,
        byPoints: byPointsIdx + 1,
        byWinPct: byWinPctIdx + 1,
        totalTeams: teamStatsForRanking.length,
      };
    }

    // Helper to calculate tiered badges
    function calculateBadges(
      rosterId: string,
      seasonsPlayed: number,
      tradeCount: number,
      totalPoints: number,
      wins: number,
      losses: number,
      playoffAppearances: number
    ): TieredBadges {
      // Seasons badge (everyone gets one): veteran (5+), regular (3+), newcomer (1+)
      let seasonsTier: SeasonsTier = 'newcomer';
      if (seasonsPlayed >= 5) seasonsTier = 'veteran';
      else if (seasonsPlayed >= 3) seasonsTier = 'regular';

      // Trades badge: master (top3), dealer (10+), active (5+), first (1+)
      let tradesTier: TradesTier = null;
      if (sortedByTrades.includes(rosterId) && tradeCount > 0) {
        tradesTier = 'master';
      } else if (tradeCount >= 10) {
        tradesTier = 'dealer';
      } else if (tradeCount >= 5) {
        tradesTier = 'active';
      } else if (tradeCount >= 1) {
        tradesTier = 'first';
      }

      // Scoring badge: elite (20k+), prolific (10k+), scorer (5k+)
      let scoringTier: ScoringTier = null;
      if (totalPoints >= 20000) scoringTier = 'elite';
      else if (totalPoints >= 10000) scoringTier = 'prolific';
      else if (totalPoints >= 5000) scoringTier = 'scorer';

      // Wins badge: dominant (50+), winner (25+), competitor (10+), club500 (.500+)
      let winsTier: WinsTier = null;
      const totalGames = wins + losses;
      const winPct = totalGames > 0 ? wins / totalGames : 0;

      if (wins >= 50) winsTier = 'dominant';
      else if (wins >= 25) winsTier = 'winner';
      else if (wins >= 10) winsTier = 'competitor';
      else if (winPct >= 0.5 && totalGames >= 5) winsTier = 'club500';

      // Playoffs badge: king (most), regular (3+), contender (1+)
      let playoffsTier: PlayoffsTier = null;
      if (playoffAppearances > 0 && playoffAppearances === maxPlayoffAppearances && maxPlayoffAppearances >= 2) {
        playoffsTier = 'king';
      } else if (playoffAppearances >= 3) {
        playoffsTier = 'regular';
      } else if (playoffAppearances >= 1) {
        playoffsTier = 'contender';
      }

      return {
        seasons: seasonsTier,
        trades: tradesTier,
        scoring: scoringTier,
        wins: winsTier,
        playoffs: playoffsTier,
      };
    }

    // Build team-specific superlatives
    const teamSuperlatives: Record<string, {
      totalTrades: number;
      bestSeason: { season: number; wins: number; losses: number; points: number } | null;
      totalPoints: number;
      playoffAppearances: number;
      championships: number;
      isTradeMaster: boolean;
      isWaiverHawk: boolean;
      allTimeRecord: { wins: number; losses: number } | null;
      seasonsPlayed: number;
      rankings: TeamRankings | null;
      badges: TieredBadges | null;
    }> = {};

    for (const roster of league.rosters) {
      // Find stats by matching the rosterId we stored during aggregation
      // This is more reliable than matching by sleeperId key
      const stats = [...ownerStats.values()].find(s => s.rosterId === roster.id) || null;
      const tradeCount = tradeCountMap.get(roster.id) || 0;

      const seasonsPlayed = stats?.seasonsPlayed || 0;
      const totalPoints = stats ? Math.round(stats.totalPoints) : 0;
      const wins = stats?.totalWins || 0;
      const losses = stats?.totalLosses || 0;
      const playoffAppearances = stats?.playoffAppearances || 0;

      teamSuperlatives[roster.id] = {
        totalTrades: tradeCount,
        bestSeason: stats?.bestSeason || null,
        totalPoints,
        playoffAppearances,
        championships: stats?.championships || 0,
        isTradeMaster: sortedByTrades.includes(roster.id),
        isWaiverHawk: false, // Placeholder - would need waiver transaction data
        allTimeRecord: stats ? { wins, losses } : null,
        seasonsPlayed,
        rankings: getRanking(roster.id),
        badges: seasonsPlayed > 0 ? calculateBadges(
          roster.id,
          seasonsPlayed,
          tradeCount,
          totalPoints,
          wins,
          losses,
          playoffAppearances
        ) : null,
      };
    }

    const response: SuperlativesResponse = {
      leagueSuperlatives: {
        mostTrades,
        bestRecord,
        mostPoints,
        mostPlayoffAppearances,
        mostChampionships,
      },
      teamSuperlatives,
      badges: {
        tradeMasters: sortedByTrades,
        waiverHawks: [], // Placeholder
      },
    };

    const jsonResponse = NextResponse.json(response);
    jsonResponse.headers.set("Cache-Control", "private, s-maxage=300, stale-while-revalidate=600");
    return jsonResponse;
  } catch (error) {
    logger.error("Superlatives fetch error", error);
    return NextResponse.json(
      {
        error: "Failed to fetch superlatives",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
