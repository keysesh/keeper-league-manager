import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

/**
 * GET /api/leagues/[leagueId]/rosters
 * Get all rosters for a league with optional player data
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

    const { searchParams } = new URL(request.url);
    const includePlayers = searchParams.get("includePlayers") === "true";
    const season = parseInt(searchParams.get("season") || String(getCurrentSeason()));

    // Verify league exists and user has access
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        rosters: {
          select: {
            id: true,
            teamMembers: {
              where: { userId: session.user.id },
              select: { id: true },
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

    const userHasAccess = league.rosters.some((r) => r.teamMembers.length > 0);
    if (!userHasAccess) {
      return NextResponse.json(
        { error: "You don't have access to this league" },
        { status: 403 }
      );
    }

    // Fetch rosters with keepers
    const rosters = await prisma.roster.findMany({
      where: { leagueId },
      select: {
        id: true,
        sleeperId: true,
        teamName: true,
        wins: true,
        losses: true,
        ties: true,
        pointsFor: true,
        pointsAgainst: true,
        keepers: {
          where: { season },
          select: {
            id: true,
            playerId: true,
            type: true,
            baseCost: true,
            finalCost: true,
            yearsKept: true,
          },
        },
      },
      orderBy: [
        { wins: "desc" },
        { pointsFor: "desc" },
      ],
    });

    // If players requested, fetch them separately with proper typing
    const rosterPlayersMap = new Map<string, Array<{
      id: string;
      sleeperId: string;
      fullName: string;
      position: string | null;
      team: string | null;
    }>>();

    if (includePlayers) {
      const rosterPlayers = await prisma.rosterPlayer.findMany({
        where: {
          rosterId: { in: rosters.map((r) => r.id) },
        },
        include: {
          player: {
            select: {
              id: true,
              sleeperId: true,
              fullName: true,
              position: true,
              team: true,
            },
          },
        },
      });

      // Group by roster
      for (const rp of rosterPlayers) {
        if (!rosterPlayersMap.has(rp.rosterId)) {
          rosterPlayersMap.set(rp.rosterId, []);
        }
        rosterPlayersMap.get(rp.rosterId)!.push(rp.player);
      }
    }

    // Transform response
    const transformedRosters = rosters.map((roster) => {
      const rosterPlayersList = rosterPlayersMap.get(roster.id) || [];

      const players = rosterPlayersList.map((player) => ({
        id: player.id,
        sleeperId: player.sleeperId,
        fullName: player.fullName,
        position: player.position,
        team: player.team,
        yearsKept: roster.keepers.find((k) => k.playerId === player.id)?.yearsKept || 0,
        draftRound: roster.keepers.find((k) => k.playerId === player.id)?.baseCost || null,
      }));

      return {
        id: roster.id,
        sleeperId: roster.sleeperId,
        teamName: roster.teamName,
        wins: roster.wins,
        losses: roster.losses,
        ties: roster.ties,
        pointsFor: roster.pointsFor,
        pointsAgainst: roster.pointsAgainst,
        players,
        currentKeepers: roster.keepers.map((k) => ({
          playerId: k.playerId,
          type: k.type,
          baseCost: k.baseCost,
          finalCost: k.finalCost,
          yearsKept: k.yearsKept,
        })),
      };
    });

    return NextResponse.json({
      rosters: transformedRosters,
      count: transformedRosters.length,
    });
  } catch (error) {
    console.error("Error fetching rosters:", error);
    return NextResponse.json(
      { error: "Failed to fetch rosters" },
      { status: 500 }
    );
  }
}
