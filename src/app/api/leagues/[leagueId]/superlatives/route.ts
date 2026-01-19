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

// Historical league IDs - same as owner-history
const HISTORICAL_LEAGUES: Record<string, { season: string; sleeperLeagueId: string }[]> = {
  "1124469358312456192": [
    { season: "2024", sleeperLeagueId: "1109261023418314752" },
    { season: "2023", sleeperLeagueId: "991458482647871488" },
  ],
};

interface TeamSuperlative {
  rosterId: string;
  teamName: string | null;
  value: number;
  season?: number;
  detail?: string;
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
  }>;
  badges: {
    tradeMasters: string[];  // roster IDs of top 3 traders
    waiverHawks: string[];   // roster IDs of top 3 waiver users (placeholder)
  };
}

const sleeper = new SleeperClient();

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
          },
        },
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const rosterMap = new Map(league.rosters.map(r => [r.id, r]));
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

    // Get historical data for all owners
    const historicalLeagues = HISTORICAL_LEAGUES[league.sleeperId] || [];

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
    }>();

    // Fetch current season data
    const [currentSleeperRosters, currentWinnersBracket] = await Promise.all([
      sleeper.getRosters(league.sleeperId),
      sleeper.getWinnersBracket(league.sleeperId),
    ]);

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

      const dbRosterId = sleeperIdToRosterId.get(roster.owner_id);
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

          const dbRosterId = sleeperIdToRosterId.get(roster.owner_id);
          const wins = roster.settings?.wins || 0;
          const losses = roster.settings?.losses || 0;
          const points = roster.settings?.fpts || 0;
          const inPlayoffs = isInPlayoffs(histWinnersBracket, roster.roster_id);
          const champion = isChampion(histWinnersBracket, roster.roster_id);

          const historicalSeason = {
            season: parseInt(historicalLeague.season),
            wins,
            losses,
            points,
          };

          const existing = ownerStats.get(roster.owner_id);
          if (existing) {
            existing.totalWins += wins;
            existing.totalLosses += losses;
            existing.totalPoints += points;
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

    // Build team-specific superlatives
    const teamSuperlatives: Record<string, {
      totalTrades: number;
      bestSeason: { season: number; wins: number; losses: number; points: number } | null;
      totalPoints: number;
      playoffAppearances: number;
      championships: number;
      isTradeMaster: boolean;
      isWaiverHawk: boolean;
    }> = {};

    for (const roster of league.rosters) {
      const ownerSleeperId = roster.sleeperId;
      const stats = ownerSleeperId ? ownerStats.get(ownerSleeperId) : null;
      const tradeCount = tradeCountMap.get(roster.id) || 0;

      teamSuperlatives[roster.id] = {
        totalTrades: tradeCount,
        bestSeason: stats?.bestSeason || null,
        totalPoints: stats ? Math.round(stats.totalPoints) : 0,
        playoffAppearances: stats?.playoffAppearances || 0,
        championships: stats?.championships || 0,
        isTradeMaster: sortedByTrades.includes(roster.id),
        isWaiverHawk: false, // Placeholder - would need waiver transaction data
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
