import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";
import {
  calculateRosterProjections,
  calculateLeagueProjectionsSummary,
  calculateKeeperProjections,
} from "@/lib/keeper/projections";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

/**
 * GET /api/leagues/[leagueId]/projections
 * Get keeper projections for the league or specific roster
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
    const rosterId = searchParams.get("rosterId");
    const playerId = searchParams.get("playerId");
    const season = parseInt(searchParams.get("season") || String(getCurrentSeason()));
    const years = parseInt(searchParams.get("years") || "3");

    // Verify league exists and user has access
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        keeperSettings: true,
        rosters: {
          select: {
            id: true,
            teamName: true,
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

    // If specific player requested
    if (playerId && rosterId) {
      const projection = await calculateKeeperProjections(
        playerId,
        rosterId,
        leagueId,
        season,
        years
      );

      return NextResponse.json({ projection });
    }

    // If specific roster requested
    if (rosterId) {
      const roster = league.rosters.find((r) => r.id === rosterId);
      if (!roster) {
        return NextResponse.json(
          { error: "Roster not found" },
          { status: 404 }
        );
      }

      const projections = await calculateRosterProjections(
        rosterId,
        leagueId,
        season,
        years
      );

      return NextResponse.json({
        rosterId,
        rosterName: roster.teamName,
        projections,
      });
    }

    // Get league-wide summary
    const summary = await calculateLeagueProjectionsSummary(leagueId, season);

    // Get all rosters with their projections
    const rosterProjections = await Promise.all(
      league.rosters.map(async (roster) => {
        const projections = await calculateRosterProjections(
          roster.id,
          leagueId,
          season,
          years
        );

        return {
          rosterId: roster.id,
          rosterName: roster.teamName,
          keeperCount: projections.length,
          projections: projections.map((p) => ({
            playerId: p.playerId,
            playerName: p.playerName,
            position: p.position,
            currentCost: p.currentCost,
            currentYearsKept: p.currentYearsKept,
            maxYearsRemaining: p.maxYearsRemaining,
            valueTrajectory: p.valueTrajectory,
            nextSeasonCost: p.projections[1]?.cost ?? null,
          })),
        };
      })
    );

    return NextResponse.json({
      season,
      yearsProjected: years,
      settings: league.keeperSettings,
      summary,
      rosters: rosterProjections,
    });
  } catch (error) {
    logger.error("Error calculating projections", error);
    return NextResponse.json(
      { error: "Failed to calculate projections" },
      { status: 500 }
    );
  }
}
