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

    // Fetch playoff brackets from Sleeper
    const [winnersBracket, losersBracket] = await Promise.all([
      sleeper.getWinnersBracket(league.sleeperId),
      sleeper.getLosersBracket(league.sleeperId),
    ]);

    // Create a map of sleeperId (owner_id) to roster info
    // Note: Sleeper bracket uses roster_id (1-based index), not owner_id
    const rosterMap = new Map<number, {
      id: string;
      teamName: string | null;
      ownerName: string | null;
      wins: number;
      losses: number;
      pointsFor: number;
    }>();

    // The bracket t1/t2 values are 1-based roster indices
    // We need to match them to our rosters somehow
    // Sleeper's roster_id in the bracket corresponds to the roster's position
    league.rosters.forEach((roster, index) => {
      // Try to extract roster_id from sleeperId if it's numeric
      const rosterIdNum = parseInt(roster.sleeperId, 10);
      const effectiveId = isNaN(rosterIdNum) ? index + 1 : rosterIdNum;

      rosterMap.set(effectiveId, {
        id: roster.id,
        teamName: roster.teamName,
        ownerName: roster.teamMembers[0]?.user?.displayName ||
                   roster.teamMembers[0]?.user?.sleeperUsername || null,
        wins: roster.wins,
        losses: roster.losses,
        pointsFor: Number(roster.pointsFor),
      });
    });

    // Also create a map by index (1-based) as fallback
    league.rosters.forEach((roster, index) => {
      if (!rosterMap.has(index + 1)) {
        rosterMap.set(index + 1, {
          id: roster.id,
          teamName: roster.teamName,
          ownerName: roster.teamMembers[0]?.user?.displayName ||
                     roster.teamMembers[0]?.user?.sleeperUsername || null,
          wins: roster.wins,
          losses: roster.losses,
          pointsFor: Number(roster.pointsFor),
        });
      }
    });

    // Transform bracket data with roster names
    const enrichBracket = (bracket: typeof winnersBracket) => {
      return bracket.map(matchup => ({
        round: matchup.r,
        matchupId: matchup.m,
        team1: matchup.t1 ? rosterMap.get(matchup.t1) || { id: String(matchup.t1), teamName: `Team ${matchup.t1}`, ownerName: null } : null,
        team2: matchup.t2 ? rosterMap.get(matchup.t2) || { id: String(matchup.t2), teamName: `Team ${matchup.t2}`, ownerName: null } : null,
        team1From: matchup.t1_from,
        team2From: matchup.t2_from,
        winner: matchup.w ? rosterMap.get(matchup.w) || { id: String(matchup.w), teamName: `Team ${matchup.w}`, ownerName: null } : null,
        loser: matchup.l ? rosterMap.get(matchup.l) || { id: String(matchup.l), teamName: `Team ${matchup.l}`, ownerName: null } : null,
        placement: matchup.p,
      }));
    };

    const settings = league.settings as Record<string, unknown> | null;

    return NextResponse.json({
      leagueId: league.id,
      season: league.season,
      playoffTeams: settings?.playoff_teams ?? 6,
      playoffWeekStart: settings?.playoff_week_start ?? 15,
      winnersBracket: enrichBracket(winnersBracket),
      losersBracket: enrichBracket(losersBracket),
    });
  } catch (error) {
    console.error("Error fetching playoffs:", error);
    return NextResponse.json(
      { error: "Failed to fetch playoff data" },
      { status: 500 }
    );
  }
}
