import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ leagueId: string; playerId: string }>;
}

/**
 * Get the NFL season for a given date
 */
function getSeasonFromDate(date: Date): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month < 2) return year - 1;
  return year;
}

/**
 * GET /api/leagues/[leagueId]/players/[playerId]
 *
 * Returns comprehensive player profile data including:
 * - Basic player info
 * - Season stats
 * - Keeper history in this league
 * - Trade history in this league
 * - Current roster ownership
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId, playerId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this league
    const userAccess = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        name: true,
        season: true,
        rosters: {
          select: {
            id: true,
            sleeperId: true,
            teamName: true,
            teamMembers: {
              where: { userId: session.user.id },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!userAccess || !userAccess.rosters.some((r) => r.teamMembers.length > 0)) {
      return NextResponse.json({ error: "You don't have access to this league" }, { status: 403 });
    }

    // Get player info - try database ID first, then Sleeper ID
    let player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        seasonStats: {
          orderBy: { season: "desc" },
          take: 5,
        },
      },
    });

    if (!player) {
      player = await prisma.player.findUnique({
        where: { sleeperId: playerId },
        include: {
          seasonStats: {
            orderBy: { season: "desc" },
            take: 5,
          },
        },
      });
    }

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Get current roster for this player in this league
    const currentRoster = await prisma.rosterPlayer.findFirst({
      where: {
        playerId: player.id,
        roster: { leagueId },
      },
      include: {
        roster: {
          select: {
            id: true,
            teamName: true,
            sleeperId: true,
          },
        },
      },
    });

    // Get keeper history for this player in this league
    const keepers = await prisma.keeper.findMany({
      where: {
        playerId: player.id,
        roster: { leagueId },
      },
      include: {
        roster: {
          select: {
            id: true,
            teamName: true,
            sleeperId: true,
          },
        },
      },
      orderBy: { season: "desc" },
    });

    // Get draft history for this player in this league
    const draftPicks = await prisma.draftPick.findMany({
      where: {
        playerId: player.id,
        draft: { leagueId },
      },
      include: {
        draft: {
          select: {
            season: true,
          },
        },
        roster: {
          select: {
            id: true,
            teamName: true,
            sleeperId: true,
          },
        },
      },
      orderBy: { draft: { season: "desc" } },
    });

    // Get trade history for this player in this league
    const trades = await prisma.transactionPlayer.findMany({
      where: {
        playerId: player.id,
        transaction: {
          leagueId,
          type: "TRADE",
        },
      },
      include: {
        transaction: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
      orderBy: { transaction: { createdAt: "desc" } },
    });

    // Get roster IDs for trade details
    const tradeRosterIds = new Set<string>();
    for (const trade of trades) {
      if (trade.fromRosterId) tradeRosterIds.add(trade.fromRosterId);
      if (trade.toRosterId) tradeRosterIds.add(trade.toRosterId);
    }

    const tradeRosters = await prisma.roster.findMany({
      where: { id: { in: [...tradeRosterIds] } },
      select: { id: true, teamName: true, sleeperId: true },
    });

    const rosterMap = new Map(tradeRosters.map((r) => [r.id, r]));

    // Build trade history with team names
    const tradeHistory = trades.map((trade) => ({
      date: trade.transaction.createdAt.toISOString(),
      season: getSeasonFromDate(trade.transaction.createdAt),
      fromTeam: trade.fromRosterId
        ? rosterMap.get(trade.fromRosterId)?.teamName || "Unknown"
        : null,
      toTeam: trade.toRosterId
        ? rosterMap.get(trade.toRosterId)?.teamName || "Unknown"
        : null,
    }));

    // Build timeline for this league
    type TimelineEvent = {
      season: number;
      date?: string;
      event: string;
      teamName: string;
      details?: Record<string, unknown>;
    };

    const timeline: TimelineEvent[] = [];

    // Add draft events
    for (const pick of draftPicks) {
      timeline.push({
        season: pick.draft.season,
        event: pick.isKeeper ? "KEPT" : "DRAFTED",
        teamName: pick.roster?.teamName || "Unknown",
        details: {
          round: pick.round,
          pick: pick.pickNumber,
          isKeeper: pick.isKeeper,
        },
      });
    }

    // Add keeper events
    for (const keeper of keepers) {
      // Check if we already have a KEPT event for this season from draft
      const hasDraftKeeper = timeline.some(
        (t) => t.season === keeper.season && t.event === "KEPT"
      );
      if (!hasDraftKeeper) {
        timeline.push({
          season: keeper.season,
          event: keeper.type === "FRANCHISE" ? "FRANCHISE_TAG" : "KEPT",
          teamName: keeper.roster.teamName || "Unknown",
          details: {
            cost: keeper.finalCost,
            type: keeper.type,
            yearsKept: keeper.yearsKept,
          },
        });
      }
    }

    // Add trade events
    for (const trade of tradeHistory) {
      if (trade.toTeam) {
        timeline.push({
          season: trade.season,
          date: trade.date,
          event: "TRADED",
          teamName: trade.toTeam,
          details: {
            from: trade.fromTeam,
            to: trade.toTeam,
          },
        });
      }
    }

    // Sort timeline
    timeline.sort((a, b) => {
      if (a.date && b.date) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      return b.season - a.season;
    });

    // Calculate keeper value info
    const originalDraft = draftPicks.find((p) => !p.isKeeper);
    const totalYearsKept = keepers.length;
    const franchiseTags = keepers.filter((k) => k.type === "FRANCHISE").length;

    return NextResponse.json({
      player: {
        id: player.id,
        sleeperId: player.sleeperId,
        fullName: player.fullName,
        firstName: player.firstName,
        lastName: player.lastName,
        position: player.position,
        team: player.team,
        age: player.age,
        yearsExp: player.yearsExp,
        status: player.status,
        injuryStatus: player.injuryStatus,
        fantasyPointsPpr: player.fantasyPointsPpr,
        gamesPlayed: player.gamesPlayed,
        pointsPerGame: player.pointsPerGame,
        adp: player.adp,
        projectedPoints: player.projectedPoints,
      },
      currentRoster: currentRoster?.roster || null,
      seasonStats: player.seasonStats.map((s) => ({
        season: s.season,
        gamesPlayed: s.gamesPlayed,
        fantasyPointsPpr: s.fantasyPointsPpr,
        ppg: s.gamesPlayed > 0 ? Math.round((s.fantasyPointsPpr / s.gamesPlayed) * 10) / 10 : 0,
        passingYards: s.passingYards,
        passingTds: s.passingTds,
        interceptions: s.interceptions,
        rushingYards: s.rushingYards,
        rushingTds: s.rushingTds,
        receptions: s.receptions,
        receivingYards: s.receivingYards,
        receivingTds: s.receivingTds,
        targets: s.targets,
      })),
      keeperInfo: {
        originalDraftRound: originalDraft?.round || null,
        originalDraftSeason: originalDraft?.draft.season || null,
        totalYearsKept,
        franchiseTags,
        currentKeeper: keepers[0] || null,
      },
      timeline,
      tradeHistory,
      league: {
        id: userAccess.id,
        name: userAccess.name,
        season: userAccess.season,
      },
    });
  } catch (error) {
    logger.error("Error fetching player profile", error);
    return NextResponse.json(
      { error: "Failed to fetch player profile" },
      { status: 500 }
    );
  }
}
