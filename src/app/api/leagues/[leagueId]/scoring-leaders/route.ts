/**
 * Scoring Leaders API Route
 * GET /api/leagues/[leagueId]/scoring-leaders — top rostered players by PPG
 * with the owning team's name, for the League screen's SCORING LEADERS list.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

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
    const limit = Math.min(
      Math.max(parseInt(request.nextUrl.searchParams.get("limit") || "3", 10), 1),
      10
    );

    const rows = await prisma.rosterPlayer.findMany({
      where: {
        roster: { leagueId },
        player: { pointsPerGame: { gt: 0 } },
      },
      select: {
        roster: { select: { id: true, teamName: true } },
        player: {
          select: {
            id: true,
            sleeperId: true,
            fullName: true,
            position: true,
            team: true,
            pointsPerGame: true,
          },
        },
      },
      orderBy: { player: { pointsPerGame: "desc" } },
      take: limit,
    });

    const response = NextResponse.json({
      leaders: rows.map((r) => ({
        playerId: r.player.id,
        sleeperId: r.player.sleeperId,
        fullName: r.player.fullName,
        position: r.player.position,
        team: r.player.team,
        pointsPerGame: r.player.pointsPerGame,
        ownerTeamName: r.roster.teamName,
        rosterId: r.roster.id,
      })),
    });
    response.headers.set(
      "Cache-Control",
      "private, s-maxage=300, stale-while-revalidate=600"
    );
    return response;
  } catch (error) {
    logger.error("Error fetching scoring leaders", error);
    return NextResponse.json(
      { error: "Failed to fetch scoring leaders" },
      { status: 500 }
    );
  }
}
