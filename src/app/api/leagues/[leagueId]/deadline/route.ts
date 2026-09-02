/**
 * GET /api/leagues/[leagueId]/deadline
 *
 * Keeper deadline status + data freshness for a league.
 * One lightweight endpoint powering the deadline banner, countdown,
 * draft-board lock chip and the "Updated from Sleeper" stamp.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getKeeperDeadlineStatus } from "@/lib/keeper/deadline";

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

    // League members only
    const membership = await prisma.roster.findFirst({
      where: {
        leagueId,
        teamMembers: { some: { userId: session.user.id } },
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have access to this league" },
        { status: 403 }
      );
    }

    const [status, league] = await Promise.all([
      getKeeperDeadlineStatus(leagueId),
      prisma.league.findUnique({
        where: { id: leagueId },
        select: { lastSyncedAt: true },
      }),
    ]);

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const response = NextResponse.json({
      ...status,
      lastSyncedAt: league.lastSyncedAt?.toISOString() ?? null,
    });

    // Planning state changes on every add/remove, and it is per-user. Without
    // this the browser is free to serve a cached body to the revalidation the
    // workspace fires right after a save, so the screen keeps showing the old
    // slots. eligible-keepers was given the same header in a2e4ad3 ("Fix keeper
    // data not refreshing after add/remove"); the endpoints below were missed.
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (error) {
    logger.error("Error fetching deadline status", error);
    return NextResponse.json(
      { error: "Failed to fetch deadline status" },
      { status: 500 }
    );
  }
}
