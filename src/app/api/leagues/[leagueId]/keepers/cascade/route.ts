import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { calculateCascade } from "@/lib/keeper/cascade";
import { getKeeperPlanningSeason } from "@/lib/constants/keeper-rules";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

/**
 * GET /api/leagues/[leagueId]/keepers/cascade
 * Calculate the cascade for all keepers in a league
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
    const season = parseInt(searchParams.get("season") || String(getKeeperPlanningSeason()));

    // Get league with settings
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        keeperSettings: true,
        rosters: {
          select: {
            id: true,
            sleeperId: true,
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

    // Get all keepers for this season
    const keepers = await prisma.keeper.findMany({
      where: {
        roster: { leagueId },
        season,
      },
      include: {
        player: true,
        roster: {
          select: {
            id: true,
            sleeperId: true,
            teamName: true,
          },
        },
      },
    });

    // Get traded picks for this season
    const tradedPicks = await prisma.tradedPick.findMany({
      where: {
        leagueId,
        season,
      },
    });

    // Prepare keeper inputs for cascade calculation
    // IMPORTANT: Use database player ID (k.playerId), not Sleeper ID
    const keeperInputs = keepers.map((k) => ({
      playerId: k.playerId, // Database ID, not k.player.sleeperId
      rosterId: k.rosterId,
      playerName: k.player.fullName,
      type: k.type as "FRANCHISE" | "REGULAR",
    }));

    // Calculate cascade
    const cascadeResult = await calculateCascade(leagueId, keeperInputs, season);

    // Group cascade results by roster
    const keepersByRoster = new Map<string, typeof cascadeResult.keepers>();
    for (const keeper of cascadeResult.keepers) {
      if (!keepersByRoster.has(keeper.rosterId)) {
        keepersByRoster.set(keeper.rosterId, []);
      }
      keepersByRoster.get(keeper.rosterId)!.push(keeper);
    }

    const detailedCascade: Array<{
      rosterId: string;
      rosterName: string | null;
      results: Array<{
        playerId: string;
        playerName: string;
        position: string | null;
        team: string | null;
        baseCost: number;
        finalCost: number;
        cascaded: boolean;
        cascadeReason: string | null;
      }>;
      tradedAwayPicks: number[];
      acquiredPicks: Array<{ round: number; fromRosterId: string }>;
    }> = [];

    for (const roster of league.rosters) {
      const rosterKeepers = keepersByRoster.get(roster.id) || [];

      // Find traded picks for this roster
      const tradedAway = tradedPicks
        .filter(p => p.originalOwnerId === roster.sleeperId && p.currentOwnerId !== roster.sleeperId)
        .map(p => p.round);

      const acquired = tradedPicks
        .filter(p => p.currentOwnerId === roster.sleeperId && p.originalOwnerId !== roster.sleeperId)
        .map(p => ({
          round: p.round,
          fromRosterId: p.originalOwnerId,
        }));

      detailedCascade.push({
        rosterId: roster.id,
        rosterName: roster.teamName,
        results: rosterKeepers.map(r => {
          const keeper = keepers.find(k => k.playerId === r.playerId);
          return {
            playerId: keeper?.player.sleeperId || r.playerId, // Return Sleeper ID for UI
            playerName: r.playerName,
            position: keeper?.player.position || null,
            team: keeper?.player.team || null,
            baseCost: r.baseCost,
            finalCost: r.finalCost,
            cascaded: r.isCascaded,
            cascadeReason: r.isCascaded
              ? `Cascaded from round ${r.baseCost} to ${r.finalCost}`
              : null,
          };
        }),
        tradedAwayPicks: tradedAway,
        acquiredPicks: acquired,
      });
    }

    // Calculate draft board slots
    const draftBoard: Array<{
      round: number;
      slots: Array<{
        rosterId: string;
        rosterName: string | null;
        status: "available" | "keeper" | "traded";
        keeper?: {
          playerId: string;
          playerName: string;
          position: string | null;
        };
        tradedTo?: string;
      }>;
    }> = [];

    // Build a map of which picks each roster currently owns
    const rosterOwnedPicks = new Map<string, Set<number>>();
    for (const roster of league.rosters) {
      // Start with all rounds
      const ownedPicks = new Set<number>();
      for (let r = 1; r <= league.draftRounds; r++) {
        ownedPicks.add(r);
      }
      rosterOwnedPicks.set(roster.id, ownedPicks);
    }

    // Process trades: remove traded picks, add acquired picks
    for (const trade of tradedPicks) {
      const originalRoster = league.rosters.find(r => r.sleeperId === trade.originalOwnerId);
      const currentRoster = league.rosters.find(r => r.sleeperId === trade.currentOwnerId);

      if (originalRoster) {
        rosterOwnedPicks.get(originalRoster.id)?.delete(trade.round);
      }
      if (currentRoster) {
        rosterOwnedPicks.get(currentRoster.id)?.add(trade.round);
      }
    }

    for (let round = 1; round <= league.draftRounds; round++) {
      const slots = league.rosters.map(roster => {
        const ownedPicks = rosterOwnedPicks.get(roster.id) || new Set();
        const rosterKeepers = keepersByRoster.get(roster.id) || [];

        // Check if this roster OWNS this round's pick (original or acquired)
        const ownsPick = ownedPicks.has(round);

        // Check if this roster's original pick was traded away
        const tradedAwayPick = tradedPicks.find(
          p => p.round === round &&
            p.originalOwnerId === roster.sleeperId &&
            p.currentOwnerId !== roster.sleeperId
        );

        // Check if this roster acquired a pick at this round
        const acquiredPick = tradedPicks.find(
          p => p.round === round &&
            p.currentOwnerId === roster.sleeperId &&
            p.originalOwnerId !== roster.sleeperId
        );

        // Check if this slot has a keeper
        const keeperInSlot = rosterKeepers.find(k => k.finalCost === round);

        // If they traded away their original pick and didn't acquire another at this round
        if (tradedAwayPick && !ownsPick) {
          const newOwner = league.rosters.find(r => r.sleeperId === tradedAwayPick.currentOwnerId);
          return {
            rosterId: roster.id,
            rosterName: roster.teamName,
            status: "traded" as const,
            tradedTo: newOwner?.teamName || tradedAwayPick.currentOwnerId,
          };
        }

        // If they have a keeper at this round
        if (keeperInSlot && ownsPick) {
          const keeper = keepers.find(k => k.playerId === keeperInSlot.playerId);
          const fromTeam = acquiredPick
            ? league.rosters.find(r => r.sleeperId === acquiredPick.originalOwnerId)?.teamName
            : null;
          return {
            rosterId: roster.id,
            rosterName: roster.teamName,
            status: "keeper" as const,
            keeper: {
              playerId: keeper?.player.sleeperId || keeperInSlot.playerId,
              playerName: keeperInSlot.playerName,
              position: keeper?.player.position || null,
              team: keeper?.player.team || null,
              yearsKept: keeper?.yearsKept || 1,
              keeperType: keeper?.type || "REGULAR",
            },
            acquiredFrom: fromTeam || undefined,
          };
        }

        // Available slot (own pick or acquired, no keeper)
        if (ownsPick) {
          const fromTeam = acquiredPick
            ? league.rosters.find(r => r.sleeperId === acquiredPick.originalOwnerId)?.teamName
            : null;
          return {
            rosterId: roster.id,
            rosterName: roster.teamName,
            status: "available" as const,
            acquiredFrom: fromTeam || undefined,
          };
        }

        // Traded away (shouldn't reach here, but fallback)
        if (tradedAwayPick) {
          const newOwner = league.rosters.find(r => r.sleeperId === tradedAwayPick.currentOwnerId);
          return {
            rosterId: roster.id,
            rosterName: roster.teamName,
            status: "traded" as const,
            tradedTo: newOwner?.teamName || tradedAwayPick.currentOwnerId,
          };
        }

        return {
          rosterId: roster.id,
          rosterName: roster.teamName,
          status: "available" as const,
        };
      });

      draftBoard.push({ round, slots });
    }

    return NextResponse.json({
      season,
      leagueId,
      totalRosters: league.rosters.length,
      draftRounds: league.draftRounds,
      cascade: detailedCascade,
      draftBoard,
      summary: {
        totalKeepers: keepers.length,
        cascadedKeepers: cascadeResult.keepers.filter(k => k.isCascaded).length,
        tradedPicks: tradedPicks.length,
      },
      errors: cascadeResult.errors,
      conflicts: cascadeResult.conflicts,
    });
  } catch (error) {
    logger.error("Error calculating cascade", error);
    return NextResponse.json(
      { error: "Failed to calculate cascade" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leagues/[leagueId]/keepers/cascade
 * Apply cascade and update all keeper final costs
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: { keeperSettings: true },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    const season = getKeeperPlanningSeason();

    // Get all keepers for this season
    const keepers = await prisma.keeper.findMany({
      where: {
        roster: { leagueId },
        season,
      },
      include: {
        player: true,
      },
    });

    // Prepare keeper inputs
    // IMPORTANT: Use database player ID (k.playerId), not Sleeper ID
    const keeperInputs = keepers.map((k) => ({
      playerId: k.playerId, // Database ID
      rosterId: k.rosterId,
      playerName: k.player.fullName,
      type: k.type as "FRANCHISE" | "REGULAR",
    }));

    // Calculate cascade
    const cascadeResult = await calculateCascade(leagueId, keeperInputs, season);

    if (cascadeResult.hasErrors) {
      return NextResponse.json(
        { error: "Cascade calculation has errors", errors: cascadeResult.errors },
        { status: 400 }
      );
    }

    // Update all keeper final costs
    let updatedCount = 0;
    for (const result of cascadeResult.keepers) {
      const keeper = keepers.find(
        k => k.playerId === result.playerId && k.rosterId === result.rosterId
      );

      if (keeper) {
        await prisma.keeper.update({
          where: { id: keeper.id },
          data: { finalCost: result.finalCost },
        });
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} keeper costs`,
      updatedCount,
    });
  } catch (error) {
    logger.error("Error applying cascade", error);
    return NextResponse.json(
      { error: "Failed to apply cascade" },
      { status: 500 }
    );
  }
}
