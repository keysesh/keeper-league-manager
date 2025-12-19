import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";

const sleeper = new SleeperClient();

/**
 * GET /api/leagues
 * Get all leagues for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get("season") || String(getCurrentSeason()));
    const includeFromSleeper = searchParams.get("includeFromSleeper") === "true";

    // Get leagues from database where user has a roster
    const dbLeagues = await prisma.league.findMany({
      where: {
        season,
        rosters: {
          some: {
            teamMembers: {
              some: { userId: session.user.id },
            },
          },
        },
      },
      include: {
        rosters: {
          where: {
            teamMembers: {
              some: { userId: session.user.id },
            },
          },
          include: {
            teamMembers: true,
            _count: {
              select: { rosterPlayers: true },
            },
          },
        },
        keeperSettings: true,
        _count: {
          select: {
            rosters: true,
            drafts: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Optionally fetch from Sleeper to find new leagues
    let sleeperLeagues: Array<{
      league_id: string;
      name: string;
      season: string;
      total_rosters: number;
      status: string;
      isNew: boolean;
    }> = [];

    if (includeFromSleeper) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { sleeperId: true },
      });

      if (user?.sleeperId) {
        const rawLeagues = await sleeper.getUserLeagues(user.sleeperId, season);

        // Mark which ones are already synced
        const syncedIds = new Set(dbLeagues.map(l => l.sleeperId));

        sleeperLeagues = rawLeagues.map(league => ({
          league_id: league.league_id,
          name: league.name,
          season: league.season,
          total_rosters: league.total_rosters,
          status: league.status,
          isNew: !syncedIds.has(league.league_id),
        }));
      }
    }

    return NextResponse.json({
      leagues: dbLeagues.map(league => ({
        id: league.id,
        sleeperId: league.sleeperId,
        name: league.name,
        season: league.season,
        status: league.status,
        totalRosters: league.totalRosters,
        lastSyncedAt: league.lastSyncedAt,
        keeperSettings: league.keeperSettings,
        userRoster: league.rosters[0] ? {
          id: league.rosters[0].id,
          teamName: league.rosters[0].teamName,
          wins: league.rosters[0].wins,
          losses: league.rosters[0].losses,
          playerCount: league.rosters[0]._count.rosterPlayers,
        } : null,
        counts: {
          rosters: league._count.rosters,
          drafts: league._count.drafts,
        },
      })),
      sleeperLeagues: sleeperLeagues.filter(l => l.isNew),
    });
  } catch (error) {
    console.error("Error fetching leagues:", error);
    return NextResponse.json(
      { error: "Failed to fetch leagues" },
      { status: 500 }
    );
  }
}
