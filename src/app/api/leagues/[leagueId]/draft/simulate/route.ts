import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateCascade, KeeperInput } from "@/lib/keeper/cascade";
import { calculateBaseCost } from "@/lib/keeper/calculator";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

interface SimulateRequest {
  keepers: Array<{
    playerId: string;
    rosterId: string;
    type: "FRANCHISE" | "REGULAR";
  }>;
  season?: number;
}

/**
 * POST /api/leagues/[leagueId]/draft/simulate
 * Simulate cascade calculation without saving to database
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

    const body: SimulateRequest = await request.json();
    const { keepers, season: requestedSeason } = body;
    const season = requestedSeason || getCurrentSeason();

    if (!keepers || !Array.isArray(keepers)) {
      return NextResponse.json(
        { error: "keepers array is required" },
        { status: 400 }
      );
    }

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
        tradedPicks: {
          where: { season },
        },
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    // Validate and enrich keeper data
    const keeperInputs: KeeperInput[] = [];
    const errors: string[] = [];

    for (const keeper of keepers) {
      // Validate roster exists
      const roster = league.rosters.find((r) => r.id === keeper.rosterId);
      if (!roster) {
        errors.push(`Roster ${keeper.rosterId} not found`);
        continue;
      }

      // Get player info
      const player = await prisma.player.findUnique({
        where: { id: keeper.playerId },
      });

      if (!player) {
        errors.push(`Player ${keeper.playerId} not found`);
        continue;
      }

      keeperInputs.push({
        playerId: player.sleeperId,
        rosterId: keeper.rosterId,
        playerName: player.fullName,
        type: keeper.type,
      });
    }

    if (errors.length > 0 && keeperInputs.length === 0) {
      return NextResponse.json(
        { error: "No valid keepers to simulate", errors },
        { status: 400 }
      );
    }

    // Calculate cascade
    const cascadeResult = await calculateCascade(leagueId, keeperInputs, season);

    // Enrich with player details and costs breakdown
    const enrichedKeepers = await Promise.all(
      cascadeResult.keepers.map(async (k) => {
        const player = await prisma.player.findFirst({
          where: { sleeperId: k.playerId },
        });

        return {
          playerId: player?.id || k.playerId,
          sleeperPlayerId: k.playerId,
          playerName: k.playerName,
          position: player?.position || null,
          team: player?.team || null,
          rosterId: k.rosterId,
          rosterName:
            league.rosters.find((r) => r.id === k.rosterId)?.teamName || null,
          baseCost: k.baseCost,
          finalCost: k.finalCost,
          cascadeSteps: k.cascadeSteps,
          isCascaded: k.isCascaded,
          conflictsWith: k.conflictsWith,
        };
      })
    );

    // Group by roster for easy consumption
    const byRoster = new Map<
      string,
      {
        rosterId: string;
        rosterName: string | null;
        keepers: typeof enrichedKeepers;
        totalCost: number;
        franchiseCount: number;
        regularCount: number;
      }
    >();

    for (const keeper of enrichedKeepers) {
      if (!byRoster.has(keeper.rosterId)) {
        byRoster.set(keeper.rosterId, {
          rosterId: keeper.rosterId,
          rosterName: keeper.rosterName,
          keepers: [],
          totalCost: 0,
          franchiseCount: 0,
          regularCount: 0,
        });
      }

      const rosterData = byRoster.get(keeper.rosterId)!;
      rosterData.keepers.push(keeper);
      rosterData.totalCost += keeper.finalCost;

      const originalKeeper = keepers.find(
        (k) =>
          k.rosterId === keeper.rosterId &&
          (k.playerId === keeper.playerId ||
            k.playerId === keeper.sleeperPlayerId)
      );
      if (originalKeeper?.type === "FRANCHISE") {
        rosterData.franchiseCount++;
      } else {
        rosterData.regularCount++;
      }
    }

    // Build draft board preview
    const draftBoard: Array<{
      round: number;
      slots: Array<{
        rosterId: string;
        rosterName: string | null;
        status: "available" | "keeper" | "traded";
        keeper?: {
          playerName: string;
          position: string | null;
          isCascaded: boolean;
        };
        tradedTo?: string;
      }>;
    }> = [];

    for (let round = 1; round <= league.draftRounds; round++) {
      const slots = league.rosters.map((roster) => {
        // Check if pick is traded
        const tradedPick = league.tradedPicks.find(
          (tp) =>
            tp.round === round &&
            tp.originalOwnerId === roster.sleeperId &&
            tp.currentOwnerId !== roster.sleeperId
        );

        if (tradedPick) {
          const newOwner = league.rosters.find(
            (r) => r.sleeperId === tradedPick.currentOwnerId
          );
          return {
            rosterId: roster.id,
            rosterName: roster.teamName,
            status: "traded" as const,
            tradedTo: newOwner?.teamName || tradedPick.currentOwnerId,
          };
        }

        // Check if keeper in this slot
        const keeperInSlot = enrichedKeepers.find(
          (k) => k.rosterId === roster.id && k.finalCost === round
        );

        if (keeperInSlot) {
          return {
            rosterId: roster.id,
            rosterName: roster.teamName,
            status: "keeper" as const,
            keeper: {
              playerName: keeperInSlot.playerName,
              position: keeperInSlot.position,
              isCascaded: keeperInSlot.isCascaded,
            },
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
      success: true,
      season,
      simulation: {
        keepers: enrichedKeepers,
        byRoster: Array.from(byRoster.values()),
        draftBoard,
        conflicts: cascadeResult.conflicts,
        hasErrors: cascadeResult.hasErrors,
        errors: [...errors, ...cascadeResult.errors],
      },
      summary: {
        totalKeepers: enrichedKeepers.length,
        cascadedKeepers: enrichedKeepers.filter((k) => k.isCascaded).length,
        totalConflicts: cascadeResult.conflicts.length,
      },
    });
  } catch (error) {
    console.error("Error simulating draft:", error);
    return NextResponse.json(
      { error: "Failed to simulate draft" },
      { status: 500 }
    );
  }
}
