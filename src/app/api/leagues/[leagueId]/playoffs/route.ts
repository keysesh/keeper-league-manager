import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

const sleeper = new SleeperClient();

/**
 * GET /api/leagues/[leagueId]/playoffs
 * Get playoff bracket data for a league
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

    // Get league with rosters
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        rosters: {
          select: {
            id: true,
            sleeperId: true,
            teamName: true,
            wins: true,
            losses: true,
            pointsFor: true,
            teamMembers: {
              select: {
                userId: true,
                user: {
                  select: {
                    displayName: true,
                    sleeperUsername: true,
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

    // Fetch playoff brackets AND rosters from Sleeper
    // We need rosters to map roster_id to owner_id
    const [winnersBracket, losersBracket, sleeperRosters] = await Promise.all([
      sleeper.getWinnersBracket(league.sleeperId),
      sleeper.getLosersBracket(league.sleeperId),
      sleeper.getRosters(league.sleeperId),
    ]);

    // Create a map from Sleeper roster_id to owner_id
    const rosterIdToOwnerId = new Map<number, string>();
    sleeperRosters.forEach((sr) => {
      if (sr.owner_id) {
        rosterIdToOwnerId.set(sr.roster_id, sr.owner_id);
      }
    });

    // Create a map from owner_id (our sleeperId) to roster info
    const ownerIdToRoster = new Map<string, {
      id: string;
      teamName: string | null;
      ownerName: string | null;
      wins: number;
      losses: number;
      pointsFor: number;
    }>();

    league.rosters.forEach((roster) => {
      ownerIdToRoster.set(roster.sleeperId, {
        id: roster.id,
        teamName: roster.teamName,
        ownerName: roster.teamMembers[0]?.user?.displayName ||
                   roster.teamMembers[0]?.user?.sleeperUsername || null,
        wins: roster.wins,
        losses: roster.losses,
        pointsFor: Number(roster.pointsFor),
      });
    });

    // Create final map from Sleeper roster_id to our roster info
    const rosterMap = new Map<number, {
      id: string;
      teamName: string | null;
      ownerName: string | null;
      wins: number;
      losses: number;
      pointsFor: number;
    }>();

    rosterIdToOwnerId.forEach((ownerId, rosterId) => {
      const rosterInfo = ownerIdToRoster.get(ownerId);
      if (rosterInfo) {
        rosterMap.set(rosterId, rosterInfo);
      }
    });

    // Transform bracket data with roster names
    // Include sleeperRosterId so we can map back if needed
    const enrichBracket = (bracket: typeof winnersBracket) => {
      return bracket.map(matchup => {
        const team1Info = matchup.t1 ? rosterMap.get(matchup.t1) : null;
        const team2Info = matchup.t2 ? rosterMap.get(matchup.t2) : null;
        const winnerInfo = matchup.w ? rosterMap.get(matchup.w) : null;
        const loserInfo = matchup.l ? rosterMap.get(matchup.l) : null;

        return {
          round: matchup.r,
          matchupId: matchup.m,
          team1: team1Info ? { ...team1Info, sleeperRosterId: matchup.t1 } : (matchup.t1 ? { id: String(matchup.t1), teamName: `Team ${matchup.t1}`, ownerName: null, sleeperRosterId: matchup.t1 } : null),
          team2: team2Info ? { ...team2Info, sleeperRosterId: matchup.t2 } : (matchup.t2 ? { id: String(matchup.t2), teamName: `Team ${matchup.t2}`, ownerName: null, sleeperRosterId: matchup.t2 } : null),
          team1From: matchup.t1_from,
          team2From: matchup.t2_from,
          winner: winnerInfo ? { ...winnerInfo, sleeperRosterId: matchup.w } : (matchup.w ? { id: String(matchup.w), teamName: `Team ${matchup.w}`, ownerName: null, sleeperRosterId: matchup.w } : null),
          loser: loserInfo ? { ...loserInfo, sleeperRosterId: matchup.l } : (matchup.l ? { id: String(matchup.l), teamName: `Team ${matchup.l}`, ownerName: null, sleeperRosterId: matchup.l } : null),
          placement: matchup.p,
        };
      });
    };

    // Also return the roster mapping for client-side use
    const rosterIdMapping: Record<number, string> = {};
    rosterMap.forEach((info, sleeperRosterId) => {
      rosterIdMapping[sleeperRosterId] = info.id;
    });

    const settings = league.settings as Record<string, unknown> | null;

    return NextResponse.json({
      leagueId: league.id,
      season: league.season,
      playoffTeams: settings?.playoff_teams ?? 6,
      playoffWeekStart: settings?.playoff_week_start ?? 15,
      winnersBracket: enrichBracket(winnersBracket),
      losersBracket: enrichBracket(losersBracket),
      rosterIdMapping, // Maps Sleeper roster_id (1-10) to our DB roster UUID
    });
  } catch (error) {
    console.error("Error fetching playoffs:", error);
    return NextResponse.json(
      { error: "Failed to fetch playoff data" },
      { status: 500 }
    );
  }
}
