/**
 * Trade Value Calculator
 *
 * Comprehensive trade analysis with:
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
// PLAYER VALUE CALCULATION
// ============================================

/**
 * Calculate age modifier bonus
 * Younger players are more valuable
 * Peak value at age 24, decreases as age increases
 */
function calculateAgeModifier(age: number | null): number {
  if (!age) return 0;
  // 24yo = +15, 30yo = +9, 35yo = +4, 40yo = 0
  return Math.max(0, 15 - (age - 24));
}

/**
 * Calculate keeper value bonus based on cost
 * Lower cost (earlier round) = higher bonus
 */
function calculateKeeperValueBonus(
  cost: number | null,
  undraftedRound: number
): number {
  if (!cost) return 0;
  // R1 cost = (10-1)*3 = 27 bonus
  // R5 cost = (10-5)*3 = 15 bonus
  // R10 cost = 0 bonus
  return Math.max(0, (undraftedRound - cost) * 3);
}

/**
 * Calculate cost trajectory for a player on a new team
 * Shows costs for each year until max keeper years reached
 */
function calculateCostTrajectory(
  startingCost: number,
  startingYearsKept: number,
  maxYears: number,
  minRound: number
): CostTrajectoryYear[] {
  const trajectory: CostTrajectoryYear[] = [];

  // Calculate trajectory until max years reached
  // yearsRemaining = how many more years this player can be kept
  const yearsRemaining = maxYears - startingYearsKept;

  for (let year = 1; year <= yearsRemaining; year++) {
    // Cost improves by 1 round each consecutive year
    const yearCost = Math.max(minRound, startingCost - (year - 1));
    const isFinal = year === yearsRemaining;

    trajectory.push({
      year,
      cost: yearCost,
      isFinalYear: isFinal,
    });
  }

  return trajectory;
}

/**
 * Get consecutive years a player was kept on a specific roster
 */
async function getConsecutiveYearsKept(
  playerId: string,
  rosterId: string,
  currentSeason: number
): Promise<number> {
  const keepers = await prisma.keeper.findMany({
    where: {
      playerId,
      rosterId,
      season: { lt: currentSeason },
    },
    orderBy: { season: "desc" },
  });

  let consecutiveYears = 0;
  let checkSeason = currentSeason - 1;

  for (const keeper of keepers) {
    if (keeper.season === checkSeason) {
      consecutiveYears++;
      checkSeason--;
    } else {
      break;
    }
  }

  return consecutiveYears;
}

/**
 * Get keeper info for a player on a specific roster
 */
async function getPlayerKeeperInfo(
  playerId: string,
  rosterId: string,
  season: number,
  settings: {
    maxKeepers: number;
    maxFranchiseTags: number;
    maxRegularKeepers: number;
    regularKeeperMaxYears: number | null;
    undraftedRound: number | null;
  } | null
) {
  const maxYears =
    settings?.regularKeeperMaxYears ?? DEFAULT_KEEPER_RULES.REGULAR_KEEPER_MAX_YEARS;

  // Get current keeper record if exists
  const currentKeeper = await prisma.keeper.findFirst({
    where: {
      playerId,
      rosterId,
      season,
    },
  });

  // Get consecutive years kept
  const yearsKept = await getConsecutiveYearsKept(playerId, rosterId, season);

  // Check current keeper count for eligibility
  const currentKeepers = await prisma.keeper.findMany({
    where: {
      rosterId,
      season,
    },
  });

  const franchiseCount = currentKeepers.filter((k) => k.type === "FRANCHISE").length;
  const regularCount = currentKeepers.filter((k) => k.type === "REGULAR").length;

  const atMaxYears = yearsKept >= maxYears;

  return {
    isCurrentKeeper: !!currentKeeper,
    currentCost: currentKeeper?.finalCost || null,
    yearsKept,
    maxYearsAllowed: maxYears,
    isEligibleForRegular: !atMaxYears && regularCount < (settings?.maxRegularKeepers ?? 5),
    isEligibleForFranchise: franchiseCount < (settings?.maxFranchiseTags ?? 2),
    keeperType: currentKeeper?.type as "FRANCHISE" | "REGULAR" | null,
  };
}

/**
 * Calculate the base keeper cost for a player (without years kept adjustment)
 */
async function getPlayerBaseCost(
  playerId: string,
  rosterId: string,
  settings: {
    undraftedRound: number | null;
    minimumRound: number | null;
    costReductionPerYear: number | null;
  } | null
): Promise<number> {
  const undraftedRound = settings?.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND;
  const minRound = settings?.minimumRound ?? DEFAULT_KEEPER_RULES.MINIMUM_ROUND;

  // Check for draft pick
  const draftPick = await prisma.draftPick.findFirst({
    where: { playerId },
    include: { draft: true },
    orderBy: { draft: { season: "asc" } }, // Get original draft
  });

  if (draftPick) {
    return Math.max(minRound, draftPick.round);
  }

  // Undrafted player
  return undraftedRound;
}

/**
 * Calculate comprehensive trade value for a single player
 */
export async function calculatePlayerTradeValue(
  playerId: string,
  sourceRosterId: string,
  destRosterId: string,
  leagueId: string,
  tradeDate: Date = new Date()
): Promise<PlayerTradeValue> {
  const season = getCurrentSeason();

  // Get league settings
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { keeperSettings: true },
  });

  const settings = league?.keeperSettings;
  const undraftedRound = settings?.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND;
  const minRound = settings?.minimumRound ?? DEFAULT_KEEPER_RULES.MINIMUM_ROUND;
  const maxYears =
    settings?.regularKeeperMaxYears ?? DEFAULT_KEEPER_RULES.REGULAR_KEEPER_MAX_YEARS;

  // Get player info
  const player = await prisma.player.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  // Get keeper status on source team
  const keeperStatus = await getPlayerKeeperInfo(playerId, sourceRosterId, season, settings || null);

  // Determine trade deadline impact
  const tradeSeason = tradeDate.getMonth() >= 8 ? tradeDate.getFullYear() : tradeDate.getFullYear() - 1;
  const isAfterDeadline = isTradeAfterDeadline(tradeDate, tradeSeason);
  const tradeDeadlineImpact = isAfterDeadline ? "reset" : "preserved";

  // Calculate new cost on destination team
  let newCost: number;
  let yearsKeptReset: boolean;
  let newYearsKept: number;

  if (isAfterDeadline) {
    // Offseason trade - value resets to undrafted round, years kept resets
    newCost = undraftedRound;
    yearsKeptReset = true;
    newYearsKept = 0;
  } else {
    // In-season trade - value preserved, years kept carries over
    const baseCost = await getPlayerBaseCost(playerId, sourceRosterId, settings || null);
    newCost = Math.max(minRound, baseCost - keeperStatus.yearsKept);
    yearsKeptReset = false;
    newYearsKept = keeperStatus.yearsKept;
  }

  // Calculate cost change (negative = better/lower round)
  const currentCost = keeperStatus.currentCost || undraftedRound;
  const costChange = newCost - currentCost;

  // Calculate cost trajectory on new team
  const costTrajectory = calculateCostTrajectory(
    newCost,
    newYearsKept,
    maxYears,
    minRound
  );

  // Calculate trade value components
  const basePositionValue = BASE_POSITION_VALUES[player.position || ""] || 10;
  const ageModifier = calculateAgeModifier(player.age);
  const keeperValueBonus = calculateKeeperValueBonus(newCost, undraftedRound);
  const totalValue = basePositionValue + ageModifier + keeperValueBonus;

  return {
    playerId: player.id,
    sleeperId: player.sleeperId,
    playerName: player.fullName,
    position: player.position,
    team: player.team,
    age: player.age,
    yearsExp: player.yearsExp,
    injuryStatus: player.injuryStatus,

    keeperStatus,

    projection: {
      newCost,
      costChange,
      yearsKeptReset,
      tradeDeadlineImpact,
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

// ============================================
// DRAFT PICK VALUE CALCULATION
// ============================================

/**
 * Calculate the value of a draft pick
 */
export function calculateDraftPickValue(
  round: number,
  season: number,
  currentSeason: number = getCurrentSeason()
): number {
  // Base value decreases by round
  let value = Math.max(
    DRAFT_PICK_MIN_VALUE,
    DRAFT_PICK_BASE_VALUE - (round - 1) * DRAFT_PICK_DECAY
  );

  // Apply future season discount
  const yearsOut = season - currentSeason;
  if (yearsOut > 0) {
    value = value * Math.pow(1 - FUTURE_SEASON_DISCOUNT, yearsOut);
  }

  return Math.round(value);
}

/**
 * Get draft pick with ownership info
 */
export async function getDraftPickInfo(
  leagueId: string,
  rosterId: string,
  round: number,
  season: number
): Promise<DraftPickValue> {
  // Get roster info
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: { sleeperId: true, teamName: true },
  });

  // Check if this pick is traded away
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

// ============================================
// TEAM ANALYSIS
// ============================================

/**
 * Calculate position breakdown from roster
 */
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

/**
 * Calculate position changes between before and after
 */
function calculatePositionChanges(
  before: PositionBreakdown,
  after: PositionBreakdown
): PositionChange[] {
  const changes: PositionChange[] = [];

  for (const position of Object.keys(before)) {
    const change = after[position] - before[position];
    if (change !== 0) {
      changes.push({
        position,
        before: before[position],
        after: after[position],
        change,
      });
    }
  }

  return changes;
}

/**
 * Build team trade analysis
 */
async function buildTeamAnalysis(
  rosterId: string,
  rosterName: string,
  tradingAwayPlayers: PlayerTradeValue[],
  acquiringPlayers: PlayerTradeValue[],
  picksGiven: DraftPickValue[],
  picksReceived: DraftPickValue[],
  allRosterPlayers: Array<{ position: string | null }>,
  currentKeeperCount: number,
  maxKeepers: number
): Promise<TeamTradeAnalysis> {
  // Calculate roster changes
  const rosterBefore = calculatePositionBreakdown(allRosterPlayers);

  // After: subtract trading away, add acquiring
  const rosterAfter = { ...rosterBefore };
  for (const player of tradingAwayPlayers) {
    const pos = player.position || "";
    if (pos in rosterAfter) {
      rosterAfter[pos]--;
    }
  }
  for (const player of acquiringPlayers) {
    const pos = player.position || "";
    if (pos in rosterAfter) {
      rosterAfter[pos]++;
    }
  }

  const positionChanges = calculatePositionChanges(rosterBefore, rosterAfter);

  // Calculate keeper impact
  const keepersTradingAway = tradingAwayPlayers.filter(
    (p) => p.keeperStatus.isCurrentKeeper
  ).length;
  const keeperSlotsAfter = currentKeeperCount - keepersTradingAway;

  const keeperValueLost = tradingAwayPlayers
    .filter((p) => p.keeperStatus.isCurrentKeeper)
    .reduce((sum, p) => sum + p.tradeValue, 0);

  const keeperValueGained = acquiringPlayers.reduce(
    (sum, p) => sum + p.tradeValue,
    0
  );

  // Calculate draft capital
  const draftCapitalGiven = picksGiven.reduce((sum, p) => sum + p.value, 0);
  const draftCapitalReceived = picksReceived.reduce((sum, p) => sum + p.value, 0);

  // Calculate totals
  const totalValueGiven =
    tradingAwayPlayers.reduce((sum, p) => sum + p.tradeValue, 0) + draftCapitalGiven;

  const totalValueReceived =
    acquiringPlayers.reduce((sum, p) => sum + p.tradeValue, 0) + draftCapitalReceived;

  return {
    rosterId,
    rosterName,
    tradingAway: tradingAwayPlayers,
    acquiring: acquiringPlayers,
    rosterBefore,
    rosterAfter,
    positionChanges,
    keeperSlotsBefore: currentKeeperCount,
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

// ============================================
// TRADE FACTS GENERATION
// ============================================

/**
 * Generate facts about the trade (no advice, just facts)
 */
function generateTradeFacts(
  team1: TeamTradeAnalysis,
  team2: TeamTradeAnalysis,
  isAfterDeadline: boolean
): TradeFact[] {
  const facts: TradeFact[] = [];

  // Keeper cost changes for traded players
  for (const player of team1.tradingAway) {
    if (player.projection.costChange !== 0) {
      const direction = player.projection.costChange > 0 ? "increases" : "improves";
      const reason = isAfterDeadline ? "offseason trade reset" : "preserved value";
      facts.push({
        category: "keeper",
        description: `${player.playerName}: Cost ${direction} from R${player.keeperStatus.currentCost || "?"} to R${player.projection.newCost} (${reason})`,
      });
    }
  }

  for (const player of team2.tradingAway) {
    if (player.projection.costChange !== 0) {
      const direction = player.projection.costChange > 0 ? "increases" : "improves";
      const reason = isAfterDeadline ? "offseason trade reset" : "preserved value";
      facts.push({
        category: "keeper",
        description: `${player.playerName}: Cost ${direction} from R${player.keeperStatus.currentCost || "?"} to R${player.projection.newCost} (${reason})`,
      });
    }
  }

  // Position changes
  for (const change of team1.positionChanges) {
    const direction = change.change > 0 ? "gains" : "loses";
    facts.push({
      category: "roster",
      description: `${team1.rosterName}: ${direction} ${Math.abs(change.change)} ${change.position}`,
    });
  }

  for (const change of team2.positionChanges) {
    const direction = change.change > 0 ? "gains" : "loses";
    facts.push({
      category: "roster",
      description: `${team2.rosterName}: ${direction} ${Math.abs(change.change)} ${change.position}`,
    });
  }

  // Keeper slot changes
  if (team1.keeperSlotsBefore !== team1.keeperSlotsAfter) {
    const change = team1.keeperSlotsAfter - team1.keeperSlotsBefore;
    const direction = change > 0 ? "gains" : "frees";
    facts.push({
      category: "keeper",
      description: `${team1.rosterName}: Keeper slots ${team1.keeperSlotsBefore}→${team1.keeperSlotsAfter} (${direction} ${Math.abs(change)} slot${Math.abs(change) > 1 ? "s" : ""})`,
    });
  }

  if (team2.keeperSlotsBefore !== team2.keeperSlotsAfter) {
    const change = team2.keeperSlotsAfter - team2.keeperSlotsBefore;
    const direction = change > 0 ? "gains" : "frees";
    facts.push({
      category: "keeper",
      description: `${team2.rosterName}: Keeper slots ${team2.keeperSlotsBefore}→${team2.keeperSlotsAfter} (${direction} ${Math.abs(change)} slot${Math.abs(change) > 1 ? "s" : ""})`,
    });
  }

  // Draft capital changes
  if (team1.draftCapitalChange !== 0) {
    const direction = team1.draftCapitalChange > 0 ? "+" : "";
    facts.push({
      category: "draft",
      description: `${team1.rosterName}: Draft capital ${direction}${team1.draftCapitalChange} points`,
    });
  }

  if (team2.draftCapitalChange !== 0) {
    const direction = team2.draftCapitalChange > 0 ? "+" : "";
    facts.push({
      category: "draft",
      description: `${team2.rosterName}: Draft capital ${direction}${team2.draftCapitalChange} points`,
    });
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
// MAIN TRADE ANALYSIS
// ============================================

/**
 * Perform comprehensive trade analysis
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

  // Determine trade deadline status
  const tradeSeason = tradeDate.getMonth() >= 8 ? tradeDate.getFullYear() : tradeDate.getFullYear() - 1;
  const isAfterDeadline = isTradeAfterDeadline(tradeDate, tradeSeason);

  // Get league settings
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { keeperSettings: true },
  });

  const settings = league?.keeperSettings;
  const maxKeepers = settings?.maxKeepers ?? DEFAULT_KEEPER_RULES.MAX_KEEPERS;

  // Get roster data
  const [roster1, roster2] = await Promise.all([
    prisma.roster.findUnique({
      where: { id: team1RosterId },
      include: {
        rosterPlayers: { include: { player: true } },
        keepers: { where: { season } },
      },
    }),
    prisma.roster.findUnique({
      where: { id: team2RosterId },
      include: {
        rosterPlayers: { include: { player: true } },
        keepers: { where: { season } },
      },
    }),
  ]);

  if (!roster1 || !roster2) {
    throw new Error("One or both rosters not found");
  }

  // Calculate player values
  const [team1Players, team2Players] = await Promise.all([
    Promise.all(
      team1PlayerIds.map((id) =>
        calculatePlayerTradeValue(id, team1RosterId, team2RosterId, leagueId, tradeDate)
      )
    ),
    Promise.all(
      team2PlayerIds.map((id) =>
        calculatePlayerTradeValue(id, team2RosterId, team1RosterId, leagueId, tradeDate)
      )
    ),
  ]);

  // Calculate draft pick values
  const team1PickValues: DraftPickValue[] = team1Picks.map((pick) => ({
    season: pick.season,
    round: pick.round,
    originalOwnerId: team1RosterId,
    originalOwnerName: roster1.teamName,
    value: calculateDraftPickValue(pick.round, pick.season),
    isOwned: true, // Assume owned for now
  }));

  const team2PickValues: DraftPickValue[] = team2Picks.map((pick) => ({
    season: pick.season,
    round: pick.round,
    originalOwnerId: team2RosterId,
    originalOwnerName: roster2.teamName,
    value: calculateDraftPickValue(pick.round, pick.season),
    isOwned: true,
  }));

  // Build team analyses
  const [team1Analysis, team2Analysis] = await Promise.all([
    buildTeamAnalysis(
      team1RosterId,
      roster1.teamName || "Team 1",
      team1Players, // Trading away
      team2Players, // Acquiring
      team1PickValues, // Picks given
      team2PickValues, // Picks received
      roster1.rosterPlayers.map((rp) => ({ position: rp.player.position })),
      roster1.keepers.length,
      maxKeepers
    ),
    buildTeamAnalysis(
      team2RosterId,
      roster2.teamName || "Team 2",
      team2Players, // Trading away
      team1Players, // Acquiring
      team2PickValues, // Picks given
      team1PickValues, // Picks received
      roster2.rosterPlayers.map((rp) => ({ position: rp.player.position })),
      roster2.keepers.length,
      maxKeepers
    ),
  ]);

  // Generate facts
  const facts = generateTradeFacts(team1Analysis, team2Analysis, isAfterDeadline);

  // Calculate fairness score (50 = perfectly fair)
  const totalValue = team1Analysis.totalValueGiven + team2Analysis.totalValueGiven;
  const valueDiff = Math.abs(team1Analysis.netValue);
  const fairnessScore =
    totalValue > 0
      ? Math.round(50 - (valueDiff / totalValue) * 50)
      : 50;

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
