/**
 * User Stats API Route
 * GET /api/user/stats - Get comprehensive user statistics derived from Sleeper data
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface UserStats {
  user: {
    id: string;
    displayName: string | null;
    sleeperUsername: string;
    avatar: string | null;
    memberSince: Date;
  };
  leagues: {
    total: number;
    asOwner: number;
    asCoOwner: number;
    active: number;
  };
  record: {
    totalWins: number;
    totalLosses: number;
    totalTies: number;
    winPercentage: number;
    totalPointsFor: number;
    totalPointsAgainst: number;
    avgPointsPerGame: number;
  };
  keepers: {
    totalKept: number;
    franchiseTagsUsed: number;
    regularKeepers: number;
    byPosition: Record<string, number>;
    topKeptPlayers: Array<{
      playerName: string;
      position: string | null;
      timesKept: number;
    }>;
  };
  trades: {
    totalTrades: number;
    playersAcquired: number;
    playersTraded: number;
    picksAcquired: number;
    picksTraded: number;
  };
  draftPicks: {
    totalOwned: number;
    byRound: Record<number, number>;
    futurePicks: number;
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch user with all related data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        teamMemberships: {
          include: {
            roster: {
              include: {
                league: true,
                keepers: {
                  include: { player: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate league stats
    const ownedRosters = user.teamMemberships.filter((tm) => tm.role === "OWNER");
    const coOwnedRosters = user.teamMemberships.filter((tm) => tm.role === "CO_OWNER");

    // Calculate record stats
    let totalWins = 0;
    let totalLosses = 0;
    let totalTies = 0;
    let totalPointsFor = 0;
    let totalPointsAgainst = 0;

    for (const membership of user.teamMemberships) {
      totalWins += membership.roster.wins;
      totalLosses += membership.roster.losses;
      totalTies += membership.roster.ties;
      totalPointsFor += Number(membership.roster.pointsFor);
      totalPointsAgainst += Number(membership.roster.pointsAgainst);
    }

    const totalGames = totalWins + totalLosses + totalTies;
    const winPercentage = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
    const avgPointsPerGame = totalGames > 0 ? totalPointsFor / totalGames : 0;

    // Calculate keeper stats
    let totalKept = 0;
    let franchiseTagsUsed = 0;
    let regularKeepers = 0;
    const keepersByPosition: Record<string, number> = {};
    const playerKeptCount: Map<string, { name: string; position: string | null; count: number }> = new Map();

    for (const membership of user.teamMemberships) {
      for (const keeper of membership.roster.keepers) {
        totalKept++;

        if (keeper.type === "FRANCHISE") {
          franchiseTagsUsed++;
        } else {
          regularKeepers++;
        }

        const pos = keeper.player.position || "UNKNOWN";
        keepersByPosition[pos] = (keepersByPosition[pos] || 0) + 1;

        const existing = playerKeptCount.get(keeper.playerId);
        if (existing) {
          existing.count++;
        } else {
          playerKeptCount.set(keeper.playerId, {
            name: keeper.player.fullName,
            position: keeper.player.position,
            count: 1,
          });
        }
      }
    }

    const topKeptPlayers = Array.from(playerKeptCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((p) => ({
        playerName: p.name,
        position: p.position,
        timesKept: p.count,
      }));

    // Get trade stats
    const rosterIds = user.teamMemberships.map((tm) => tm.roster.id);

    const [tradedPlayers, draftPicksOwned] = await Promise.all([
      prisma.transactionPlayer.findMany({
        where: {
          OR: [
            { fromRosterId: { in: rosterIds } },
            { toRosterId: { in: rosterIds } },
          ],
          transaction: { type: "TRADE" },
        },
        include: { transaction: true },
      }),
      prisma.draftPick.findMany({
        where: { rosterId: { in: rosterIds } },
        include: { draft: true },
      }),
    ]);

    // Count unique trades
    const uniqueTradeIds = new Set(tradedPlayers.map((tp) => tp.transactionId));
    const tradesInvolved = uniqueTradeIds.size;

    let playersAcquired = 0;
    let playersTraded = 0;

    for (const tp of tradedPlayers) {
      if (rosterIds.includes(tp.toRosterId || "")) {
        playersAcquired++;
      }
      if (rosterIds.includes(tp.fromRosterId || "")) {
        playersTraded++;
      }
    }

    // Count traded picks
    const tradedPicksData = await prisma.tradedPick.findMany({
      where: {
        OR: [
          { originalOwnerId: { in: rosterIds } },
          { currentOwnerId: { in: rosterIds } },
        ],
      },
    });

    let picksAcquired = 0;
    let picksTraded = 0;
    for (const tp of tradedPicksData) {
      // If current owner is our roster but original wasn't, we acquired it
      if (rosterIds.includes(tp.currentOwnerId) && !rosterIds.includes(tp.originalOwnerId)) {
        picksAcquired++;
      }
      // If original owner was our roster but current isn't, we traded it away
      if (rosterIds.includes(tp.originalOwnerId) && !rosterIds.includes(tp.currentOwnerId)) {
        picksTraded++;
      }
    }

    // Draft pick stats
    const currentYear = new Date().getFullYear();
    const picksByRound: Record<number, number> = {};
    let futurePicks = 0;

    for (const pick of draftPicksOwned) {
      picksByRound[pick.round] = (picksByRound[pick.round] || 0) + 1;
      if (pick.draft.season > currentYear) {
        futurePicks++;
      }
    }

    const stats: UserStats = {
      user: {
        id: user.id,
        displayName: user.displayName,
        sleeperUsername: user.sleeperUsername,
        avatar: user.avatar,
        memberSince: user.createdAt,
      },
      leagues: {
        total: user.teamMemberships.length,
        asOwner: ownedRosters.length,
        asCoOwner: coOwnedRosters.length,
        active: user.teamMemberships.filter((tm) =>
          tm.roster.league.status === "IN_SEASON" || tm.roster.league.status === "DRAFTING"
        ).length,
      },
      record: {
        totalWins,
        totalLosses,
        totalTies,
        winPercentage: Math.round(winPercentage * 10) / 10,
        totalPointsFor: Math.round(totalPointsFor * 10) / 10,
        totalPointsAgainst: Math.round(totalPointsAgainst * 10) / 10,
        avgPointsPerGame: Math.round(avgPointsPerGame * 10) / 10,
      },
      keepers: {
        totalKept,
        franchiseTagsUsed,
        regularKeepers,
        byPosition: keepersByPosition,
        topKeptPlayers,
      },
      trades: {
        totalTrades: tradesInvolved,
        playersAcquired,
        playersTraded,
        picksAcquired,
        picksTraded,
      },
      draftPicks: {
        totalOwned: draftPicksOwned.length,
        byRound: picksByRound,
        futurePicks,
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    logger.error("User stats fetch error", error);
    return NextResponse.json(
      {
        error: "Failed to fetch user stats",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
