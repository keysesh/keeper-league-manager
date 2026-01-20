import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getLeagueChain } from "@/lib/services/league-chain";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

/**
 * GET /api/leagues/[leagueId]/history
 * Get all available keeper seasons and keeper history for a league (including historical seasons)
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

    // Get current league
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        rosters: {
          select: {
            id: true,
            teamName: true,
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

    // Get all leagues in the historical chain
    const leagueChain = await getLeagueChain(leagueId);

    // Get all rosters from all leagues in the chain (for team name lookup)
    const allRosters = await prisma.roster.findMany({
      where: { leagueId: { in: leagueChain } },
      select: {
        id: true,
        teamName: true,
        sleeperId: true,
        leagueId: true,
      },
    });

    // Get all unique seasons that have keepers across the league chain
    const keeperSeasons = await prisma.keeper.findMany({
      where: {
        roster: { leagueId: { in: leagueChain } },
      },
      select: {
        season: true,
      },
      distinct: ["season"],
      orderBy: { season: "desc" },
    });

    const seasons = keeperSeasons.map((k) => k.season);

    // If no keeper seasons found, check for draft seasons across the chain
    if (seasons.length === 0) {
      const draftSeasons = await prisma.draft.findMany({
        where: { leagueId: { in: leagueChain } },
        select: { season: true },
        distinct: ["season"],
        orderBy: { season: "desc" },
      });
      seasons.push(...draftSeasons.map((d) => d.season));
    }

    // Get all keepers across all seasons in the league chain
    const allKeepers = await prisma.keeper.findMany({
      where: {
        roster: { leagueId: { in: leagueChain } },
      },
      include: {
        player: true,
        roster: {
          select: {
            id: true,
            teamName: true,
            sleeperId: true,
          },
        },
      },
      orderBy: [{ season: "desc" }, { type: "asc" }, { finalCost: "asc" }],
    });

    // Calculate stats per season
    const seasonStats = seasons.map((season) => {
      const seasonKeepers = allKeepers.filter((k) => k.season === season);
      const franchiseTags = seasonKeepers.filter((k) => k.type === "FRANCHISE").length;
      const regularKeepers = seasonKeepers.filter((k) => k.type === "REGULAR").length;
      const totalCost = seasonKeepers.reduce((sum, k) => sum + k.finalCost, 0);
      const avgCost = seasonKeepers.length > 0 ? totalCost / seasonKeepers.length : 0;

      // Count positions
      const positionCounts: Record<string, number> = {};
      for (const keeper of seasonKeepers) {
        const pos = keeper.player.position || "Unknown";
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      }
      const mostKeptPosition =
        Object.entries(positionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

      return {
        season,
        totalKeepers: seasonKeepers.length,
        franchiseTags,
        regularKeepers,
        avgCost: Math.round(avgCost * 10) / 10,
        mostKeptPosition,
        positionBreakdown: positionCounts,
      };
    });

    // Format keepers for response
    const keepers = allKeepers.map((k) => ({
      id: k.id,
      season: k.season,
      type: k.type,
      baseCost: k.baseCost,
      finalCost: k.finalCost,
      yearsKept: k.yearsKept,
      player: {
        id: k.player.id,
        fullName: k.player.fullName,
        position: k.player.position,
        team: k.player.team,
      },
      roster: {
        id: k.roster.id,
        teamName: k.roster.teamName,
      },
    }));

    // Get multi-year keepers (players kept multiple consecutive years)
    const playerKeeperHistory = new Map<
      string,
      Array<{ season: number; rosterId: string; rosterName: string | null }>
    >();

    for (const keeper of allKeepers) {
      const key = keeper.player.id;
      if (!playerKeeperHistory.has(key)) {
        playerKeeperHistory.set(key, []);
      }
      playerKeeperHistory.get(key)!.push({
        season: keeper.season,
        rosterId: keeper.roster.id,
        rosterName: keeper.roster.teamName,
      });
    }

    const multiYearKeepers = Array.from(playerKeeperHistory.entries())
      .filter(([, history]) => history.length > 1)
      .map(([playerId, history]) => {
        const player = allKeepers.find((k) => k.player.id === playerId)?.player;
        return {
          playerId,
          playerName: player?.fullName || "Unknown",
          position: player?.position || null,
          seasons: history.sort((a, b) => b.season - a.season),
          yearsKept: history.length,
        };
      })
      .sort((a, b) => b.yearsKept - a.yearsKept);

    // Get unique teams by sleeperId (same team across seasons)
    const uniqueTeams = new Map<string, { id: string; teamName: string | null }>();
    for (const roster of allRosters) {
      if (!uniqueTeams.has(roster.sleeperId)) {
        uniqueTeams.set(roster.sleeperId, {
          id: roster.id,
          teamName: roster.teamName,
        });
      }
    }

    return NextResponse.json({
      leagueId,
      leagueChain, // Include for debugging/transparency
      seasons,
      seasonStats,
      keepers,
      multiYearKeepers,
      teams: Array.from(uniqueTeams.values()),
      summary: {
        totalSeasons: seasons.length,
        totalKeepers: keepers.length,
        oldestSeason: seasons.length > 0 ? Math.min(...seasons) : null,
        newestSeason: seasons.length > 0 ? Math.max(...seasons) : null,
        leaguesInChain: leagueChain.length,
      },
    });
  } catch (error) {
    logger.error("Error fetching keeper history", error);
    return NextResponse.json(
      { error: "Failed to fetch keeper history" },
      { status: 500 }
    );
  }
}
