/**
 * Trade Value Calculator
 *
 * OPTIMIZED: All data loaded in batch queries upfront, then processed in-memory.
 * Reduced from 50+ queries to ~5 queries.
 *
 * Features:
 * - Per-player keeper value details
 * - Trade deadline impact (preserved vs reset)
 * - Cost trajectory projections
 * - Age and position modifiers
 * - Draft pick valuations
 */

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_KEEPER_RULES,
  getCurrentSeason,
  isTradeAfterDeadline,
} from "@/lib/constants/keeper-rules";
import {
  PlayerTradeValue,
  TeamTradeAnalysis,
  DraftPickValue,
  TradeAnalysisResult,
  TradeFact,
  PositionBreakdown,
  PositionChange,
  CostTrajectoryYear,
  BASE_POSITION_VALUES,
  DRAFT_PICK_BASE_VALUE,
  DRAFT_PICK_DECAY,
  DRAFT_PICK_MIN_VALUE,
  FUTURE_SEASON_DISCOUNT,
} from "./types";

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateAgeModifier(age: number | null): number {
  if (!age) return 0;
  return Math.max(0, 15 - (age - 24));
}

function calculateKeeperValueBonus(cost: number | null, undraftedRound: number): number {
  if (!cost) return 0;
  return Math.max(0, (undraftedRound - cost) * 3);
}

function calculateCostTrajectory(
  startingCost: number,
  startingYearsKept: number,
  maxYears: number,
  minRound: number
): CostTrajectoryYear[] {
  const trajectory: CostTrajectoryYear[] = [];
  const yearsRemaining = maxYears - startingYearsKept;

  for (let year = 1; year <= yearsRemaining; year++) {
    const yearCost = Math.max(minRound, startingCost - (year - 1));
    trajectory.push({
      year,
      cost: yearCost,
      isFinalYear: year === yearsRemaining,
    });
  }

  return trajectory;
}

export function calculateDraftPickValue(
  round: number,
  season: number,
  currentSeason: number = getCurrentSeason()
): number {
  let value = Math.max(
    DRAFT_PICK_MIN_VALUE,
    DRAFT_PICK_BASE_VALUE - (round - 1) * DRAFT_PICK_DECAY
  );

  const yearsOut = season - currentSeason;
  if (yearsOut > 0) {
    value = value * Math.pow(1 - FUTURE_SEASON_DISCOUNT, yearsOut);
  }

  return Math.round(value);
}

function calculatePositionBreakdown(
  players: Array<{ position: string | null }>
): PositionBreakdown {
  const breakdown: PositionBreakdown = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const player of players) {
    const pos = player.position || "";
    if (pos in breakdown) {
      breakdown[pos]++;
    }
  }
  return breakdown;
}

function calculatePositionChanges(
  before: PositionBreakdown,
  after: PositionBreakdown
): PositionChange[] {
  const changes: PositionChange[] = [];
  for (const position of Object.keys(before)) {
    const change = after[position] - before[position];
    if (change !== 0) {
      changes.push({ position, before: before[position], after: after[position], change });
    }
  }
  return changes;
}

// ============================================
// OPTIMIZED TRADE ANALYSIS
// ============================================

/**
 * OPTIMIZED: Perform comprehensive trade analysis with batch queries
 * Reduced from 50+ queries to ~5 queries
 */
export async function analyzeTradeComprehensive(
  leagueId: string,
  team1RosterId: string,
  team2RosterId: string,
  team1PlayerIds: string[],
  team2PlayerIds: string[],
  team1Picks: Array<{ season: number; round: number }>,
  team2Picks: Array<{ season: number; round: number }>,
  tradeDate: Date = new Date()
): Promise<TradeAnalysisResult> {
  const season = getCurrentSeason();
  const allPlayerIds = [...team1PlayerIds, ...team2PlayerIds];

  // Determine trade deadline status
  const tradeSeason = tradeDate.getMonth() >= 8 ? tradeDate.getFullYear() : tradeDate.getFullYear() - 1;
  const isAfterDeadline = isTradeAfterDeadline(tradeDate, tradeSeason);

  // ========================================
  // BATCH QUERY 1: League + Settings + Both Rosters
  // ========================================
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      keeperSettings: true,
      rosters: {
        where: { id: { in: [team1RosterId, team2RosterId] } },
        include: {
          rosterPlayers: { include: { player: true } },
          keepers: { where: { season } },
        },
      },
    },
  });

  if (!league) throw new Error("League not found");

  const settings = league.keeperSettings;
  const maxKeepers = settings?.maxKeepers ?? DEFAULT_KEEPER_RULES.MAX_KEEPERS;
  const maxYears = settings?.regularKeeperMaxYears ?? DEFAULT_KEEPER_RULES.REGULAR_KEEPER_MAX_YEARS;
  const undraftedRound = settings?.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND;
  const minRound = settings?.minimumRound ?? DEFAULT_KEEPER_RULES.MINIMUM_ROUND;

  const roster1 = league.rosters.find(r => r.id === team1RosterId);
  const roster2 = league.rosters.find(r => r.id === team2RosterId);

  if (!roster1 || !roster2) throw new Error("One or both rosters not found");

  // ========================================
  // BATCH QUERY 2: All Players being traded
  // ========================================
  const players = await prisma.player.findMany({
    where: { id: { in: allPlayerIds } },
  });
  const playerMap = new Map(players.map(p => [p.id, p]));

  // ========================================
  // BATCH QUERY 3: All Draft Picks for traded players
  // ========================================
  const draftPicks = await prisma.draftPick.findMany({
    where: { playerId: { in: allPlayerIds } },
    include: { draft: true },
    orderBy: { draft: { season: "asc" } },
  });

  // Build map: playerId -> oldest draft pick
  const draftPickMap = new Map<string, typeof draftPicks[0]>();
  for (const pick of draftPicks) {
    if (pick.playerId && !draftPickMap.has(pick.playerId)) {
      draftPickMap.set(pick.playerId, pick);
    }
  }

  // ========================================
  // BATCH QUERY 4: All Keeper history for traded players
  // ========================================
  const allKeepers = await prisma.keeper.findMany({
    where: {
      playerId: { in: allPlayerIds },
      rosterId: { in: [team1RosterId, team2RosterId] },
      season: { lte: season },
    },
    orderBy: { season: "desc" },
  });

  // Build keeper lookup maps
  const currentKeeperMap = new Map<string, typeof allKeepers[0]>();
  const keeperHistoryMap = new Map<string, typeof allKeepers>();

  for (const keeper of allKeepers) {
    const key = `${keeper.playerId}-${keeper.rosterId}`;

    // Current season keeper
    if (keeper.season === season && !currentKeeperMap.has(key)) {
      currentKeeperMap.set(key, keeper);
    }

    // All keepers for history
    if (!keeperHistoryMap.has(key)) {
      keeperHistoryMap.set(key, []);
    }
    keeperHistoryMap.get(key)!.push(keeper);
  }

  // ========================================
  // IN-MEMORY PROCESSING
  // ========================================

  // Helper: Get consecutive years kept from pre-loaded data
  function getConsecutiveYears(playerId: string, rosterId: string): number {
    const key = `${playerId}-${rosterId}`;
    const history = keeperHistoryMap.get(key) || [];

    let consecutive = 0;
    let checkSeason = season - 1;

    for (const keeper of history) {
      if (keeper.season === checkSeason) {
        consecutive++;
        checkSeason--;
      } else if (keeper.season < checkSeason) {
        break;
      }
    }

    return consecutive;
  }

  // Helper: Calculate player trade value from pre-loaded data
  function calculatePlayerValue(
    playerId: string,
    sourceRosterId: string
  ): PlayerTradeValue {
    const player = playerMap.get(playerId);
    if (!player) throw new Error(`Player not found: ${playerId}`);

    const draftPick = draftPickMap.get(playerId);
    const baseCost = draftPick ? Math.max(minRound, draftPick.round) : undraftedRound;

    const yearsKept = getConsecutiveYears(playerId, sourceRosterId);
    const currentKeeper = currentKeeperMap.get(`${playerId}-${sourceRosterId}`);

    // Current cost (with years reduction applied)
    const currentCost = currentKeeper?.finalCost ?? Math.max(minRound, baseCost - yearsKept);

    // Cost NEVER changes on trade
    const newCost = currentCost;

    // Years kept depends on trade deadline
    const newYearsKept = isAfterDeadline ? 0 : yearsKept;

    const costTrajectory = calculateCostTrajectory(newCost, newYearsKept, maxYears, minRound);

    const basePositionValue = BASE_POSITION_VALUES[player.position || ""] || 10;
    const ageModifier = calculateAgeModifier(player.age);
    const keeperValueBonus = calculateKeeperValueBonus(newCost, undraftedRound);
    const totalValue = basePositionValue + ageModifier + keeperValueBonus;

    // Get current roster's keeper counts for eligibility
    const sourceRoster = sourceRosterId === team1RosterId ? roster1 : roster2;
    const franchiseCount = sourceRoster?.keepers.filter(k => k.type === "FRANCHISE").length ?? 0;
    const regularCount = sourceRoster?.keepers.filter(k => k.type === "REGULAR").length ?? 0;
    const atMaxYears = yearsKept >= maxYears;

    return {
      playerId: player.id,
      sleeperId: player.sleeperId,
      playerName: player.fullName,
      position: player.position,
      team: player.team,
      age: player.age,
      yearsExp: player.yearsExp,
      injuryStatus: player.injuryStatus,
      keeperStatus: {
        isCurrentKeeper: !!currentKeeper,
        currentCost: currentKeeper?.finalCost || null,
        yearsKept,
        maxYearsAllowed: maxYears,
        isEligibleForRegular: !atMaxYears && regularCount < (settings?.maxRegularKeepers ?? 5),
        isEligibleForFranchise: franchiseCount < (settings?.maxFranchiseTags ?? 2),
        keeperType: currentKeeper?.type as "FRANCHISE" | "REGULAR" | null,
      },
      projection: {
        newCost,
        costChange: 0,
        yearsKeptReset: isAfterDeadline,
        tradeDeadlineImpact: isAfterDeadline ? "reset" : "preserved",
        costTrajectory,
      },
      tradeValue: totalValue,
      valueBreakdown: {
        basePositionValue,
        ageModifier,
        keeperValueBonus,
        total: totalValue,
      },
    };
  }

  // Calculate player values (no database calls - all in-memory)
  const team1Players = team1PlayerIds.map(id => calculatePlayerValue(id, team1RosterId));
  const team2Players = team2PlayerIds.map(id => calculatePlayerValue(id, team2RosterId));

  // Calculate draft pick values (pure function, no database)
  const team1PickValues: DraftPickValue[] = team1Picks.map(pick => ({
    season: pick.season,
    round: pick.round,
    originalOwnerId: team1RosterId,
    originalOwnerName: roster1.teamName,
    value: calculateDraftPickValue(pick.round, pick.season),
    isOwned: true,
  }));

  const team2PickValues: DraftPickValue[] = team2Picks.map(pick => ({
    season: pick.season,
    round: pick.round,
    originalOwnerId: team2RosterId,
    originalOwnerName: roster2.teamName,
    value: calculateDraftPickValue(pick.round, pick.season),
    isOwned: true,
  }));

  // Build team analyses (pure function)
  function buildAnalysis(
    rosterId: string,
    rosterName: string,
    roster: NonNullable<typeof roster1>,
    tradingAway: PlayerTradeValue[],
    acquiring: PlayerTradeValue[],
    picksGiven: DraftPickValue[],
    picksReceived: DraftPickValue[]
  ): TeamTradeAnalysis {
    const rosterBefore = calculatePositionBreakdown(
      roster.rosterPlayers.map(rp => ({ position: rp.player.position }))
    );

    const rosterAfter = { ...rosterBefore };
    for (const p of tradingAway) {
      if (p.position && p.position in rosterAfter) rosterAfter[p.position]--;
    }
    for (const p of acquiring) {
      if (p.position && p.position in rosterAfter) rosterAfter[p.position]++;
    }

    const positionChanges = calculatePositionChanges(rosterBefore, rosterAfter);

    const keepersTradingAway = tradingAway.filter(p => p.keeperStatus.isCurrentKeeper).length;
    const keeperSlotsAfter = roster.keepers.length - keepersTradingAway;

    const keeperValueLost = tradingAway
      .filter(p => p.keeperStatus.isCurrentKeeper)
      .reduce((sum, p) => sum + p.tradeValue, 0);

    const keeperValueGained = acquiring.reduce((sum, p) => sum + p.tradeValue, 0);

    const draftCapitalGiven = picksGiven.reduce((sum, p) => sum + p.value, 0);
    const draftCapitalReceived = picksReceived.reduce((sum, p) => sum + p.value, 0);

    const totalValueGiven = tradingAway.reduce((sum, p) => sum + p.tradeValue, 0) + draftCapitalGiven;
    const totalValueReceived = acquiring.reduce((sum, p) => sum + p.tradeValue, 0) + draftCapitalReceived;

    return {
      rosterId,
      rosterName,
      tradingAway,
      acquiring,
      rosterBefore,
      rosterAfter,
      positionChanges,
      keeperSlotsBefore: roster.keepers.length,
      keeperSlotsAfter,
      keeperSlotsMax: maxKeepers,
      keeperValueLost,
      keeperValueGained,
      netKeeperValue: keeperValueGained - keeperValueLost,
      picksGiven,
      picksReceived,
      draftCapitalChange: draftCapitalReceived - draftCapitalGiven,
      totalValueGiven,
      totalValueReceived,
      netValue: totalValueReceived - totalValueGiven,
    };
  }

  const team1Analysis = buildAnalysis(
    team1RosterId,
    roster1.teamName || "Team 1",
    roster1,
    team1Players,
    team2Players,
    team1PickValues,
    team2PickValues
  );

  const team2Analysis = buildAnalysis(
    team2RosterId,
    roster2.teamName || "Team 2",
    roster2,
    team2Players,
    team1Players,
    team2PickValues,
    team1PickValues
  );

  // Generate facts
  const facts = generateTradeFacts(team1Analysis, team2Analysis, isAfterDeadline);

  // Calculate fairness score
  const totalValue = team1Analysis.totalValueGiven + team2Analysis.totalValueGiven;
  const valueDiff = Math.abs(team1Analysis.netValue);
  const fairnessScore = totalValue > 0 ? Math.round(50 - (valueDiff / totalValue) * 50) : 50;

  return {
    success: true,
    tradeDate: tradeDate.toISOString(),
    isAfterDeadline,
    season,
    team1: team1Analysis,
    team2: team2Analysis,
    summary: {
      fairnessScore: Math.max(0, Math.min(100, fairnessScore)),
      valueDifferential: valueDiff,
      facts,
    },
  };
}

// ============================================
// TRADE FACTS GENERATION
// ============================================

function generateTradeFacts(
  team1: TeamTradeAnalysis,
  team2: TeamTradeAnalysis,
  isAfterDeadline: boolean
): TradeFact[] {
  const facts: TradeFact[] = [];

  // Keeper changes
  for (const player of [...team1.tradingAway, ...team2.tradingAway]) {
    if (player.projection.yearsKeptReset && player.keeperStatus.yearsKept > 0) {
      facts.push({
        category: "keeper",
        description: `${player.playerName}: Years kept resets from ${player.keeperStatus.yearsKept} to 0 (offseason trade)`,
      });
    } else if (!player.projection.yearsKeptReset && player.keeperStatus.yearsKept > 0) {
      facts.push({
        category: "keeper",
        description: `${player.playerName}: Years kept preserved (${player.keeperStatus.yearsKept} yrs, R${player.projection.newCost})`,
      });
    }
  }

  // Position changes
  for (const team of [team1, team2]) {
    for (const change of team.positionChanges) {
      const direction = change.change > 0 ? "gains" : "loses";
      facts.push({
        category: "roster",
        description: `${team.rosterName}: ${direction} ${Math.abs(change.change)} ${change.position}`,
      });
    }
  }

  // Keeper slot changes
  for (const team of [team1, team2]) {
    if (team.keeperSlotsBefore !== team.keeperSlotsAfter) {
      const change = team.keeperSlotsAfter - team.keeperSlotsBefore;
      const direction = change > 0 ? "gains" : "frees";
      facts.push({
        category: "keeper",
        description: `${team.rosterName}: Keeper slots ${team.keeperSlotsBefore}→${team.keeperSlotsAfter} (${direction} ${Math.abs(change)} slot${Math.abs(change) > 1 ? "s" : ""})`,
      });
    }
  }

  // Draft capital changes
  for (const team of [team1, team2]) {
    if (team.draftCapitalChange !== 0) {
      const direction = team.draftCapitalChange > 0 ? "+" : "";
      facts.push({
        category: "draft",
        description: `${team.rosterName}: Draft capital ${direction}${team.draftCapitalChange} points`,
      });
    }
  }

  // Value differential
  const valueDiff = Math.abs(team1.netValue);
  if (valueDiff > 0) {
    facts.push({
      category: "value",
      description: `Trade value differential: ${valueDiff} points`,
    });
  }

  return facts;
}

// ============================================
// EXPORTS (for backwards compatibility)
// ============================================

export async function calculatePlayerTradeValue(
  playerId: string,
  sourceRosterId: string,
  destRosterId: string,
  leagueId: string,
  tradeDate: Date = new Date()
): Promise<PlayerTradeValue> {
  // Use the batch function for single player (less efficient but maintains API)
  const result = await analyzeTradeComprehensive(
    leagueId,
    sourceRosterId,
    destRosterId,
    [playerId],
    [],
    [],
    [],
    tradeDate
  );
  return result.team1.tradingAway[0];
}

export async function getDraftPickInfo(
  leagueId: string,
  rosterId: string,
  round: number,
  season: number
): Promise<DraftPickValue> {
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: { sleeperId: true, teamName: true },
  });

  const tradedPick = await prisma.tradedPick.findFirst({
    where: {
      leagueId,
      originalOwnerId: roster?.sleeperId || "",
      round,
      season,
    },
  });

  const isOwned = !tradedPick || tradedPick.currentOwnerId === roster?.sleeperId;

  return {
    season,
    round,
    originalOwnerId: rosterId,
    originalOwnerName: roster?.teamName || null,
    value: calculateDraftPickValue(round, season),
    isOwned,
  };
}
