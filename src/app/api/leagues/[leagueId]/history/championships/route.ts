/**
 * Championship History API Route
 * GET /api/leagues/[leagueId]/history/championships - Get league championship history
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface SeasonChampion {
  season: number;
  champion: {
    rosterId: string;
    teamName: string;
    owners: string[];
    wins: number;
    losses: number;
    pointsFor: number;
  };
  runnerUp: {
    rosterId: string;
    teamName: string;
    owners: string[];
    wins: number;
    losses: number;
    pointsFor: number;
  } | null;
  pointsLeader: {
    rosterId: string;
    teamName: string;
    pointsFor: number;
  };
  mostKeepers: {
    rosterId: string;
    teamName: string;
    keeperCount: number;
  } | null;
}

interface OwnerStats {
  userId: string;
  displayName: string;
  championships: number;
  secondPlace: number;
  seasonsPlayed: number;
  bestSeason: number;
  totalWins: number;
  totalLosses: number;
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

    // Get the current league and any linked previous leagues
    const currentLeague = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        season: true,
        previousLeagueId: true,
        sleeperId: true,
      },
    });

    if (!currentLeague) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    // Build full league chain by traversing previousLeagueId recursively
    const leagueChain: string[] = [leagueId];
    let currentId = currentLeague.previousLeagueId;

    // Traverse backwards through all previous seasons
    while (currentId) {
      leagueChain.push(currentId);
      const prev = await prisma.league.findUnique({
        where: { id: currentId },
        select: { previousLeagueId: true },
      });
      currentId = prev?.previousLeagueId || null;
    }

    // Also find any leagues that point to leagues in our chain (future seasons)
    const futureLeagues = await prisma.league.findMany({
      where: {
        previousLeagueId: { in: leagueChain },
        id: { notIn: leagueChain },
      },
      select: { id: true },
    });

    const allLeagueIds = [...leagueChain, ...futureLeagues.map(l => l.id)];

    // Fetch all leagues in the chain with full data
    const relatedLeagues = await prisma.league.findMany({
      where: {
        id: { in: allLeagueIds },
      },
      include: {
        rosters: {
          include: {
            teamMembers: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    sleeperUsername: true,
                  },
                },
              },
            },
            keepers: true,
          },
        },
      },
      orderBy: { season: "desc" },
    });

    // Build championship history by season
    const championships: SeasonChampion[] = [];
    const ownerStatsMap = new Map<string, OwnerStats>();

    for (const league of relatedLeagues) {
      // Sort rosters by standing (wins, then points)
      const sortedRosters = [...league.rosters].sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return Number(b.pointsFor) - Number(a.pointsFor);
      });

      if (sortedRosters.length === 0) continue;

      const champion = sortedRosters[0];
      const runnerUp = sortedRosters[1];

      // Points leader
      const pointsLeaderRoster = [...league.rosters].sort(
        (a, b) => Number(b.pointsFor) - Number(a.pointsFor)
      )[0];

      // Most keepers
      const rosterWithMostKeepers = [...league.rosters].sort(
        (a, b) => b.keepers.length - a.keepers.length
      )[0];

      championships.push({
        season: league.season,
        champion: {
          rosterId: champion.id,
          teamName: champion.teamName || "Champion",
          owners: champion.teamMembers.map(
            (tm) => tm.user.displayName || tm.user.sleeperUsername
          ),
          wins: champion.wins,
          losses: champion.losses,
          pointsFor: Number(champion.pointsFor),
        },
        runnerUp: runnerUp
          ? {
              rosterId: runnerUp.id,
              teamName: runnerUp.teamName || "Runner Up",
              owners: runnerUp.teamMembers.map(
                (tm) => tm.user.displayName || tm.user.sleeperUsername
              ),
              wins: runnerUp.wins,
              losses: runnerUp.losses,
              pointsFor: Number(runnerUp.pointsFor),
            }
          : null,
        pointsLeader: {
          rosterId: pointsLeaderRoster.id,
          teamName: pointsLeaderRoster.teamName || "Points Leader",
          pointsFor: Number(pointsLeaderRoster.pointsFor),
        },
        mostKeepers:
          rosterWithMostKeepers.keepers.length > 0
            ? {
                rosterId: rosterWithMostKeepers.id,
                teamName: rosterWithMostKeepers.teamName || "Keeper King",
                keeperCount: rosterWithMostKeepers.keepers.length,
              }
            : null,
      });

      // Track owner stats
      for (const roster of league.rosters) {
        for (const member of roster.teamMembers) {
          const userId = member.user.id;
          let stats = ownerStatsMap.get(userId);

          if (!stats) {
            stats = {
              userId,
              displayName:
                member.user.displayName || member.user.sleeperUsername,
              championships: 0,
              secondPlace: 0,
              seasonsPlayed: 0,
              bestSeason: league.season,
              totalWins: 0,
              totalLosses: 0,
            };
          }

          stats.seasonsPlayed++;
          stats.totalWins += roster.wins;
          stats.totalLosses += roster.losses;

          if (roster.id === champion.id) {
            stats.championships++;
          }
          if (runnerUp && roster.id === runnerUp.id) {
            stats.secondPlace++;
          }

          ownerStatsMap.set(userId, stats);
        }
      }
    }

    // Sort owner stats by championships, then seasons
    const ownerStats = [...ownerStatsMap.values()].sort((a, b) => {
      if (b.championships !== a.championships)
        return b.championships - a.championships;
      if (b.secondPlace !== a.secondPlace) return b.secondPlace - a.secondPlace;
      return b.totalWins - a.totalWins;
    });

    // Calculate all-time records
    const allTimeRecords = {
      mostChampionships: ownerStats[0]
        ? { name: ownerStats[0].displayName, count: ownerStats[0].championships }
        : null,
      mostSeasons: ownerStats.reduce(
        (best, owner) =>
          owner.seasonsPlayed > (best?.count || 0)
            ? { name: owner.displayName, count: owner.seasonsPlayed }
            : best,
        null as { name: string; count: number } | null
      ),
      highestSingleSeasonPoints: championships.reduce(
        (best, c) =>
          c.champion.pointsFor > (best?.points || 0)
            ? {
                name: c.champion.teamName,
                season: c.season,
                points: c.champion.pointsFor,
              }
            : best,
        null as { name: string; season: number; points: number } | null
      ),
      bestRecord: championships.reduce(
        (best, c) => {
          const winPct =
            c.champion.wins / (c.champion.wins + c.champion.losses);
          if (winPct > (best?.winPct || 0)) {
            return {
              name: c.champion.teamName,
              season: c.season,
              record: `${c.champion.wins}-${c.champion.losses}`,
              winPct,
            };
          }
          return best;
        },
        null as {
          name: string;
          season: number;
          record: string;
          winPct: number;
        } | null
      ),
    };

    const response = NextResponse.json({
      championships,
      ownerStats: ownerStats.slice(0, 10),
      allTimeRecords,
      totalSeasons: championships.length,
      generatedAt: new Date().toISOString(),
    });
    response.headers.set('Cache-Control', 'private, s-maxage=60, stale-while-revalidate=300');
    return response;
  } catch (error) {
    logger.error("Championship history fetch error", error);
    return NextResponse.json(
      {
        error: "Failed to fetch championship history",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
