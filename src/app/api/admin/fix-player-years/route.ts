import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/fix-player-years
 * Manually reset a player's keeper years (for offseason trade situations)
 *
 * Body: { leagueId, playerName }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { leagueId, playerName } = body;

    if (!leagueId || !playerName) {
      return NextResponse.json(
        { error: "leagueId and playerName are required" },
        { status: 400 }
      );
    }

    // Find the player
    const player = await prisma.player.findFirst({
      where: {
        fullName: {
          contains: playerName,
          mode: "insensitive",
        },
      },
    });

    if (!player) {
      return NextResponse.json(
        { error: `Player "${playerName}" not found` },
        { status: 404 }
      );
    }

    // Find and update any keeper records for this player in this league
    const updatedKeepers = await prisma.keeper.updateMany({
      where: {
        playerId: player.id,
        roster: { leagueId },
      },
      data: {
        yearsKept: 1,
        baseCost: player.id ? undefined : undefined, // Keep baseCost as is
      },
    });

    // Also create a fake "trade" transaction to mark this player as traded
    // This ensures the eligible-keepers route will detect them as offseason trade
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, season: true },
    });

    if (league) {
      // Find the roster that has this player
      const rosterPlayer = await prisma.rosterPlayer.findFirst({
        where: {
          playerId: player.id,
          roster: { leagueId },
        },
        select: { rosterId: true },
      });

      if (rosterPlayer) {
        // Check if trade transaction already exists
        const existingTx = await prisma.transactionPlayer.findFirst({
          where: {
            playerId: player.id,
            toRosterId: rosterPlayer.rosterId,
            transaction: { type: "TRADE" },
          },
        });

        if (!existingTx) {
          // Create a trade transaction dated in the offseason (March)
          const offseasonDate = new Date(league.season, 2, 15); // March 15 of the season year

          const transaction = await prisma.transaction.create({
            data: {
              sleeperId: `manual-trade-${player.id}-${Date.now()}`,
              leagueId: league.id,
              type: "TRADE",
              status: "complete",
              createdAt: offseasonDate,
            },
          });

          await prisma.transactionPlayer.create({
            data: {
              transactionId: transaction.id,
              playerId: player.id,
              toRosterId: rosterPlayer.rosterId,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${player.fullName}: reset to Year 1, marked as offseason trade`,
      player: {
        id: player.id,
        name: player.fullName,
      },
      keepersUpdated: updatedKeepers.count,
    });
  } catch (error) {
    console.error("Error fixing player years:", error);
    return NextResponse.json(
      { error: "Failed to fix player years" },
      { status: 500 }
    );
  }
}
