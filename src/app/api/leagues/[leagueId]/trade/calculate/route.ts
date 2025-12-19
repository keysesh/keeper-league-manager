import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

interface TradeRequest {
  team1: {
    rosterId: string;
    players: string[];
    picks: Array<{ season: number; round: number }>;
  };
  team2: {
    rosterId: string;
    players: string[];
    picks: Array<{ season: number; round: number }>;
  };
}

interface PositionBreakdown {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  K: number;
  DEF: number;
}

/**
 * POST /api/leagues/[leagueId]/trade/calculate
 * Calculate trade impact with facts-based analysis
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

    const body: TradeRequest = await request.json();
    const { team1, team2 } = body;
    const season = getCurrentSeason();

    if (!team1?.rosterId || !team2?.rosterId) {
      return NextResponse.json(
        { error: "Both team1 and team2 rosters are required" },
        { status: 400 }
      );
    }

    // Get league with settings
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        keeperSettings: true,
        tradedPicks: { where: { season } },
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    // Get roster data for both teams
    const [roster1, roster2] = await Promise.all([
      prisma.roster.findUnique({
        where: { id: team1.rosterId },
        include: {
          rosterPlayers: {
            include: { player: true },
          },
          keepers: {
            where: { season },
            include: { player: true },
          },
        },
      }),
      prisma.roster.findUnique({
        where: { id: team2.rosterId },
        include: {
          rosterPlayers: {
            include: { player: true },
          },
          keepers: {
            where: { season },
            include: { player: true },
          },
        },
      }),
    ]);

    if (!roster1 || !roster2) {
      return NextResponse.json(
        { error: "One or both rosters not found" },
        { status: 404 }
      );
    }

    // Get players involved in trade
    const team1TradePlayers = await prisma.player.findMany({
      where: { id: { in: team1.players } },
    });
    const team2TradePlayers = await prisma.player.findMany({
      where: { id: { in: team2.players } },
    });

    // Calculate position breakdown before and after
    const calculatePositionBreakdown = (
      rosterPlayers: Array<{ player: { position: string | null } }>
    ): PositionBreakdown => {
      const breakdown: PositionBreakdown = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
      for (const rp of rosterPlayers) {
        const pos = rp.player.position as keyof PositionBreakdown;
        if (pos in breakdown) {
          breakdown[pos]++;
        }
      }
      return breakdown;
    };

    const team1Before = calculatePositionBreakdown(roster1.rosterPlayers);
    const team2Before = calculatePositionBreakdown(roster2.rosterPlayers);

    // Calculate after trade
    const team1After = { ...team1Before };
    const team2After = { ...team2Before };

    // Team 1 loses players, gains team2's players
    for (const player of team1TradePlayers) {
      const pos = player.position as keyof PositionBreakdown;
      if (pos in team1After) team1After[pos]--;
    }
    for (const player of team2TradePlayers) {
      const pos = player.position as keyof PositionBreakdown;
      if (pos in team1After) team1After[pos]++;
    }

    // Team 2 loses players, gains team1's players
    for (const player of team2TradePlayers) {
      const pos = player.position as keyof PositionBreakdown;
      if (pos in team2After) team2After[pos]--;
    }
    for (const player of team1TradePlayers) {
      const pos = player.position as keyof PositionBreakdown;
      if (pos in team2After) team2After[pos]++;
    }

    // Calculate draft capital changes
    const calculateDraftCapital = (picks: Array<{ round: number }>) => {
      return picks.reduce((total, pick) => {
        // Earlier rounds worth more: Rd1=16, Rd2=15, ... Rd16=1
        return total + (17 - pick.round);
      }, 0);
    };

    const team1PicksGiven = calculateDraftCapital(team1.picks);
    const team1PicksReceived = calculateDraftCapital(team2.picks);
    const team2PicksGiven = calculateDraftCapital(team2.picks);
    const team2PicksReceived = calculateDraftCapital(team1.picks);

    // Get keeper implications
    const team1Keepers = roster1.keepers.filter(k =>
      team1.players.includes(k.playerId)
    );
    const team2Keepers = roster2.keepers.filter(k =>
      team2.players.includes(k.playerId)
    );

    // Calculate keeper slots impact
    const settings = league.keeperSettings;
    const maxKeepers = settings?.maxKeepers ?? 7;

    const team1KeepersBefore = roster1.keepers.length;
    const team2KeepersBefore = roster2.keepers.length;

    // After trade, traded keepers move but new players may or may not become keepers
    const team1KeepersAfter = team1KeepersBefore - team1Keepers.length;
    const team2KeepersAfter = team2KeepersBefore - team2Keepers.length;

    // Build keeper impact details
    const keeperImpact = {
      team1: {
        tradingAway: team1Keepers.map(k => ({
          playerName: k.player.fullName,
          position: k.player.position,
          cost: k.finalCost,
          yearsKept: k.yearsKept,
          type: k.type,
        })),
        acquiring: team2TradePlayers.map(p => {
          const wasKeeper = team2Keepers.find(k => k.playerId === p.id);
          return {
            playerName: p.fullName,
            position: p.position,
            wasKeeper: !!wasKeeper,
            previousCost: wasKeeper?.finalCost || null,
            yearsKept: wasKeeper?.yearsKept || 0,
          };
        }),
        slotsBefore: team1KeepersBefore,
        slotsAfter: team1KeepersAfter,
        maxSlots: maxKeepers,
      },
      team2: {
        tradingAway: team2Keepers.map(k => ({
          playerName: k.player.fullName,
          position: k.player.position,
          cost: k.finalCost,
          yearsKept: k.yearsKept,
          type: k.type,
        })),
        acquiring: team1TradePlayers.map(p => {
          const wasKeeper = team1Keepers.find(k => k.playerId === p.id);
          return {
            playerName: p.fullName,
            position: p.position,
            wasKeeper: !!wasKeeper,
            previousCost: wasKeeper?.finalCost || null,
            yearsKept: wasKeeper?.yearsKept || 0,
          };
        }),
        slotsBefore: team2KeepersBefore,
        slotsAfter: team2KeepersAfter,
        maxSlots: maxKeepers,
      },
    };

    // Calculate simple value scores
    const positionValues: Record<string, number> = {
      QB: 25,
      RB: 30,
      WR: 28,
      TE: 20,
      K: 5,
      DEF: 8,
    };

    const team1PlayerValue = team1TradePlayers.reduce(
      (sum, p) => sum + (positionValues[p.position || ""] || 10),
      0
    );
    const team2PlayerValue = team2TradePlayers.reduce(
      (sum, p) => sum + (positionValues[p.position || ""] || 10),
      0
    );

    const team1TotalValue = team1PlayerValue + team1PicksGiven;
    const team2TotalValue = team2PlayerValue + team2PicksGiven;

    const totalValue = team1TotalValue + team2TotalValue;
    const fairnessScore = totalValue > 0
      ? Math.round(100 - Math.abs(((team1TotalValue - team2TotalValue) / totalValue) * 100))
      : 100;

    // Determine trade winner based on net value received
    const team1NetValue = team2TotalValue - team1TotalValue;
    const team2NetValue = team1TotalValue - team2TotalValue;
    const tradeWinner = team1NetValue > team2NetValue
      ? roster1.teamName
      : team2NetValue > team1NetValue
        ? roster2.teamName
        : null;

    // Generate key facts
    const keyFacts: string[] = [];

    // Position changes
    for (const pos of ["QB", "RB", "WR", "TE"] as const) {
      const team1Change = team1After[pos] - team1Before[pos];
      const team2Change = team2After[pos] - team2Before[pos];

      if (team1Change !== 0) {
        keyFacts.push(
          `${roster1.teamName} ${team1Change > 0 ? "gains" : "loses"} ${Math.abs(team1Change)} ${pos}${Math.abs(team1Change) > 1 ? "s" : ""}`
        );
      }
      if (team2Change !== 0) {
        keyFacts.push(
          `${roster2.teamName} ${team2Change > 0 ? "gains" : "loses"} ${Math.abs(team2Change)} ${pos}${Math.abs(team2Change) > 1 ? "s" : ""}`
        );
      }
    }

    // Draft capital changes
    if (team1.picks.length > 0 || team2.picks.length > 0) {
      if (team1PicksGiven > team1PicksReceived) {
        keyFacts.push(
          `${roster1.teamName} gives up ${team1.picks.length} pick${team1.picks.length > 1 ? "s" : ""} (net -${team1PicksGiven - team1PicksReceived} value)`
        );
      } else if (team1PicksReceived > team1PicksGiven) {
        keyFacts.push(
          `${roster1.teamName} gains ${team2.picks.length} pick${team2.picks.length > 1 ? "s" : ""} (net +${team1PicksReceived - team1PicksGiven} value)`
        );
      }
    }

    // Keeper implications
    if (team1Keepers.length > 0) {
      keyFacts.push(
        `${roster1.teamName} trades ${team1Keepers.length} current keeper${team1Keepers.length > 1 ? "s" : ""}`
      );
    }
    if (team2Keepers.length > 0) {
      keyFacts.push(
        `${roster2.teamName} trades ${team2Keepers.length} current keeper${team2Keepers.length > 1 ? "s" : ""}`
      );
    }

    return NextResponse.json({
      success: true,
      analysis: {
        team1: {
          rosterId: roster1.id,
          rosterName: roster1.teamName,
          positionsBefore: team1Before,
          positionsAfter: team1After,
          positionChanges: {
            QB: team1After.QB - team1Before.QB,
            RB: team1After.RB - team1Before.RB,
            WR: team1After.WR - team1Before.WR,
            TE: team1After.TE - team1Before.TE,
          },
          draftCapitalGiven: team1PicksGiven,
          draftCapitalReceived: team1PicksReceived,
          draftCapitalChange: team1PicksReceived - team1PicksGiven,
          playerValue: team1PlayerValue,
          totalValue: team1TotalValue,
          netValue: team1NetValue,
        },
        team2: {
          rosterId: roster2.id,
          rosterName: roster2.teamName,
          positionsBefore: team2Before,
          positionsAfter: team2After,
          positionChanges: {
            QB: team2After.QB - team2Before.QB,
            RB: team2After.RB - team2Before.RB,
            WR: team2After.WR - team2Before.WR,
            TE: team2After.TE - team2Before.TE,
          },
          draftCapitalGiven: team2PicksGiven,
          draftCapitalReceived: team2PicksReceived,
          draftCapitalChange: team2PicksReceived - team2PicksGiven,
          playerValue: team2PlayerValue,
          totalValue: team2TotalValue,
          netValue: team2NetValue,
        },
        keeperImpact,
        fairnessScore,
        tradeWinner,
        keyFacts,
      },
    });
  } catch (error) {
    console.error("Error calculating trade:", error);
    return NextResponse.json(
      { error: "Failed to calculate trade" },
      { status: 500 }
    );
  }
}
