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

interface HistoricalRecord {
  season: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  playoffFinish?: string | null;
  standing?: number;
}

interface OwnerHistory {
  ownerId: string;
  displayName: string;
  avatar: string | null;
  currentTeamName: string | null;
  currentRosterId: string | null;
  seasons: HistoricalRecord[];
  totals: {
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
    pointsAgainst: number;
    championships: number;
    playoffAppearances: number;
    seasonsPlayed: number;
  };
}

function getPlayoffFinish(matchups: Array<{ p?: number; w?: number; l?: number }>, rosterId: number): string | null {
  for (const matchup of matchups) {
    if (matchup.p === 1 && matchup.w === rosterId) return "Champion";
    if (matchup.p === 1 && matchup.l === rosterId) return "Runner-up";
    if (matchup.p === 2 && matchup.w === rosterId) return "Runner-up";
    if (matchup.p === 2 && matchup.l === rosterId) return "3rd Place";
    if (matchup.p === 3 && matchup.w === rosterId) return "3rd Place";
    if (matchup.p === 3 && matchup.l === rosterId) return "4th Place";
    if (matchup.p === 5 && matchup.w === rosterId) return "5th Place";
    if (matchup.p === 5 && matchup.l === rosterId) return "6th Place";
  }
  return null;
}

/**
 * GET /api/leagues/[leagueId]/owner-history
 * Get historical W/L records for all owners across seasons
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get current league from database
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        rosters: {
          include: {
            teamMembers: {
              include: {
                user: {
                  select: {
                    displayName: true,
                    sleeperUsername: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    // Check if user has access
    const userHasAccess = league.rosters.some(roster =>
      roster.teamMembers.some(member => member.userId === session.user.id)
    );

    if (!userHasAccess) {
      return NextResponse.json(
        { error: "You don't have access to this league" },
        { status: 403 }
      );
    }

    // Dynamically discover historical leagues by following the previous_league_id chain
    const historicalLeagues = await discoverHistoricalLeagues(league.sleeperId);

    // Build owner history map by owner_id (Sleeper user ID)
    const ownerHistoryMap = new Map<string, OwnerHistory>();

    // Fetch current season data from Sleeper
    const [currentSleeperRosters, currentSleeperUsers, currentWinnersBracket] = await Promise.all([
      sleeper.getRosters(league.sleeperId),
      sleeper.getUsers(league.sleeperId),
      sleeper.getWinnersBracket(league.sleeperId),
    ]);

    // Map Sleeper user data
    const sleeperUserMap = new Map<string, { display_name: string; avatar: string | null }>();
    currentSleeperUsers.forEach(user => {
      sleeperUserMap.set(user.user_id, {
        display_name: user.display_name,
        avatar: user.avatar,
      });
    });

    // Sort rosters by wins/points to get standings
    const sortedCurrentRosters = [...currentSleeperRosters].sort((a, b) => {
      const winsA = a.settings?.wins || 0;
      const winsB = b.settings?.wins || 0;
      if (winsB !== winsA) return winsB - winsA;
      return (b.settings?.fpts || 0) - (a.settings?.fpts || 0);
    });

    // Add current season roster data
    currentSleeperRosters.forEach(roster => {
      if (!roster.owner_id) return;

      const sleeperUser = sleeperUserMap.get(roster.owner_id);
      const dbRoster = league.rosters.find(r => r.sleeperId === roster.owner_id);
      const standing = sortedCurrentRosters.findIndex(r => r.owner_id === roster.owner_id) + 1;
      const playoffFinish = getPlayoffFinish(currentWinnersBracket, roster.roster_id);

      const currentRecord: HistoricalRecord = {
        season: String(league.season),
        wins: roster.settings?.wins || 0,
        losses: roster.settings?.losses || 0,
        ties: roster.settings?.ties || 0,
        pointsFor: roster.settings?.fpts || 0,
        pointsAgainst: roster.settings?.fpts_against || 0,
        playoffFinish,
        standing,
      };

      ownerHistoryMap.set(roster.owner_id, {
        ownerId: roster.owner_id,
        displayName: sleeperUser?.display_name || dbRoster?.teamName || "Unknown",
        avatar: sleeperUser?.avatar ? `https://sleepercdn.com/avatars/thumbs/${sleeperUser.avatar}` : null,
        currentTeamName: dbRoster?.teamName || null,
        currentRosterId: dbRoster?.id || null,
        seasons: [currentRecord],
        totals: {
          wins: currentRecord.wins,
          losses: currentRecord.losses,
          ties: currentRecord.ties,
          pointsFor: currentRecord.pointsFor,
          pointsAgainst: currentRecord.pointsAgainst,
          championships: playoffFinish === "Champion" ? 1 : 0,
          playoffAppearances: playoffFinish ? 1 : 0,
          seasonsPlayed: 1,
        },
      });
    });

    // Fetch historical data from previous seasons
    for (const historicalLeague of historicalLeagues) {
      try {
        const [histRosters, histUsers, histWinnersBracket] = await Promise.all([
          sleeper.getRosters(historicalLeague.sleeperLeagueId),
          sleeper.getUsers(historicalLeague.sleeperLeagueId),
          sleeper.getWinnersBracket(historicalLeague.sleeperLeagueId),
        ]);

        // Map historical users
        const histUserMap = new Map<string, { display_name: string }>();
        histUsers.forEach(user => {
          histUserMap.set(user.user_id, { display_name: user.display_name });
        });

        // Sort for standings
        const sortedHistRosters = [...histRosters].sort((a, b) => {
          const winsA = a.settings?.wins || 0;
          const winsB = b.settings?.wins || 0;
          if (winsB !== winsA) return winsB - winsA;
          return (b.settings?.fpts || 0) - (a.settings?.fpts || 0);
        });

        // Add historical records for each roster
        histRosters.forEach(roster => {
          if (!roster.owner_id) return;

          const standing = sortedHistRosters.findIndex(r => r.owner_id === roster.owner_id) + 1;
          const playoffFinish = getPlayoffFinish(histWinnersBracket, roster.roster_id);

          const histRecord: HistoricalRecord = {
            season: String(historicalLeague.season),
            wins: roster.settings?.wins || 0,
            losses: roster.settings?.losses || 0,
            ties: roster.settings?.ties || 0,
            pointsFor: roster.settings?.fpts || 0,
            pointsAgainst: roster.settings?.fpts_against || 0,
            playoffFinish,
            standing,
          };

          const existing = ownerHistoryMap.get(roster.owner_id);
          if (existing) {
            existing.seasons.push(histRecord);
            existing.totals.wins += histRecord.wins;
            existing.totals.losses += histRecord.losses;
            existing.totals.ties += histRecord.ties;
            existing.totals.pointsFor += histRecord.pointsFor;
            existing.totals.pointsAgainst += histRecord.pointsAgainst;
            if (playoffFinish === "Champion") existing.totals.championships++;
            if (playoffFinish) existing.totals.playoffAppearances++;
            existing.totals.seasonsPlayed++;
          } else {
            const histUser = histUserMap.get(roster.owner_id);
            ownerHistoryMap.set(roster.owner_id, {
              ownerId: roster.owner_id,
              displayName: histUser?.display_name || "Former Member",
              avatar: null,
              currentTeamName: null,
              currentRosterId: null,
              seasons: [histRecord],
              totals: {
                wins: histRecord.wins,
                losses: histRecord.losses,
                ties: histRecord.ties,
                pointsFor: histRecord.pointsFor,
                pointsAgainst: histRecord.pointsAgainst,
                championships: playoffFinish === "Champion" ? 1 : 0,
                playoffAppearances: playoffFinish ? 1 : 0,
                seasonsPlayed: 1,
              },
            });
          }
        });
      } catch (error) {
        logger.error(`Error fetching historical league ${historicalLeague.sleeperLeagueId}`, error);
      }
    }

    // Sort seasons by year (descending) for each owner
    ownerHistoryMap.forEach(owner => {
      owner.seasons.sort((a, b) => parseInt(b.season) - parseInt(a.season));
    });

    // Convert to array and sort by total wins (descending)
    const ownerHistories = Array.from(ownerHistoryMap.values()).sort(
      (a, b) => b.totals.wins - a.totals.wins
    );

    return NextResponse.json({
      leagueId: league.id,
      currentSeason: String(league.season),
      availableSeasons: [String(league.season), ...historicalLeagues.map(h => String(h.season))].sort((a, b) => parseInt(b) - parseInt(a)),
      owners: ownerHistories,
    });
  } catch (error) {
    logger.error("Error fetching owner history", error);
    return NextResponse.json(
      { error: "Failed to fetch owner history" },
      { status: 500 }
    );
  }
}
