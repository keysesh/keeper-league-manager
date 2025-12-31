import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ playerId: string }>;
}

/**
 * GET /api/players/[playerId]/keeper-history
 *
 * Returns the complete keeper history for a player across all seasons and leagues.
 * Includes draft history and transaction data for context.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { playerId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get player info - try database ID first, then Sleeper ID
    let player = await prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        sleeperId: true,
        fullName: true,
        firstName: true,
        lastName: true,
        position: true,
        team: true,
        age: true,
        yearsExp: true,
      },
    });

    // If not found by database ID, try Sleeper ID
    if (!player) {
      player = await prisma.player.findUnique({
        where: { sleeperId: playerId },
        select: {
          id: true,
          sleeperId: true,
          fullName: true,
          firstName: true,
          lastName: true,
          position: true,
          team: true,
          age: true,
          yearsExp: true,
        },
      });
    }

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Get all keeper records for this player (use database ID)
    const keepers = await prisma.keeper.findMany({
      where: { playerId: player.id },
      include: {
        roster: {
          select: {
            teamName: true,
            sleeperId: true,
            league: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { season: "asc" },
    });

    // Get all draft picks for this player (use database ID)
    const draftPicks = await prisma.draftPick.findMany({
      where: { playerId: player.id },
      include: {
        draft: {
          select: {
            season: true,
            league: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        roster: {
          select: {
            teamName: true,
            sleeperId: true,
          },
        },
      },
      orderBy: { draft: { season: "asc" } },
    });

    // Build timeline data
    const timeline: Array<{
      season: number;
      event: "DRAFTED" | "KEPT_REGULAR" | "KEPT_FRANCHISE" | "NOT_KEPT";
      teamName: string;
      sleeperId: string | null;
      leagueName: string;
      leagueId: string;
      details?: {
        round?: number;
        pick?: number;
        cost?: number;
      };
    }> = [];

    // Add draft events
    for (const pick of draftPicks) {
      timeline.push({
        season: pick.draft.season,
        event: "DRAFTED",
        teamName: pick.roster?.teamName || "Unknown",
        sleeperId: pick.roster?.sleeperId || null,
        leagueName: pick.draft.league.name,
        leagueId: pick.draft.league.id,
        details: {
          round: pick.round,
          pick: pick.pickNumber,
        },
      });
    }

    // Add keeper events
    for (const keeper of keepers) {
      timeline.push({
        season: keeper.season,
        event: keeper.type === "FRANCHISE" ? "KEPT_FRANCHISE" : "KEPT_REGULAR",
        teamName: keeper.roster.teamName || "Unknown",
        sleeperId: keeper.roster.sleeperId,
        leagueName: keeper.roster.league.name,
        leagueId: keeper.roster.league.id,
        details: {
          cost: keeper.finalCost,
        },
      });
    }

    // Sort by season, then by event type (drafts before keepers)
    timeline.sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season;
      if (a.event === "DRAFTED" && b.event !== "DRAFTED") return -1;
      if (a.event !== "DRAFTED" && b.event === "DRAFTED") return 1;
      return 0;
    });

    // Group by league for multi-league support
    const leagueIds = [...new Set(timeline.map((t) => t.leagueId))];
    const byLeague = leagueIds.map((leagueId) => {
      const leagueEvents = timeline.filter((t) => t.leagueId === leagueId);
      return {
        leagueId,
        leagueName: leagueEvents[0]?.leagueName || "Unknown",
        events: leagueEvents,
      };
    });

    // Get all seasons that have data
    const seasons = [...new Set(timeline.map((t) => t.season))].sort();

    return NextResponse.json({
      player,
      timeline,
      byLeague,
      seasons,
      summary: {
        totalTimesKept: keepers.length,
        totalTimesDrafted: draftPicks.length,
        franchiseTags: keepers.filter((k) => k.type === "FRANCHISE").length,
        regularKeeps: keepers.filter((k) => k.type === "REGULAR").length,
      },
    });
  } catch (error) {
    console.error("Error fetching keeper history:", error);
    return NextResponse.json(
      { error: "Failed to fetch keeper history" },
      { status: 500 }
    );
  }
}
