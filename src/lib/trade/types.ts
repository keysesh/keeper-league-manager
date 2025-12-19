/**
 * Trade Analysis Types
 *
 * Comprehensive types for deep trade analysis with pure facts, no advice.
 * Shows exactly what values change for each player and team.
 */

// ============================================
// PLAYER VALUE TYPES
// ============================================

export interface KeeperStatus {
  isCurrentKeeper: boolean;
  currentCost: number | null;
  yearsKept: number;
  maxYearsAllowed: number;
  isEligibleForRegular: boolean;
  isEligibleForFranchise: boolean;
  keeperType: "FRANCHISE" | "REGULAR" | null;
}

export interface CostTrajectoryYear {
  year: number;
  cost: number;
  isFinalYear: boolean;
}

export interface KeeperProjection {
  newCost: number;
  costChange: number; // negative = better (lower round)
  yearsKeptReset: boolean;
  tradeDeadlineImpact: "preserved" | "reset";
  costTrajectory: CostTrajectoryYear[];
}

export interface PlayerTradeValue {
  playerId: string;
  sleeperId: string;
  playerName: string;
  position: string | null;
  team: string | null;
  age: number | null;
  yearsExp: number | null;
  injuryStatus: string | null;

  // Keeper value details on source team
  keeperStatus: KeeperStatus;

  // Post-trade projections on destination team
  projection: KeeperProjection;

  // Calculated value
  tradeValue: number;
  valueBreakdown: {
    basePositionValue: number;
    ageModifier: number;
    keeperValueBonus: number;
    total: number;
  };
}

// ============================================
// DRAFT PICK TYPES
// ============================================

export interface DraftPickValue {
  season: number;
  round: number;
  originalOwnerId: string;
  originalOwnerName: string | null;
  value: number;
  isOwned: boolean; // false if already traded away
}

// ============================================
// TEAM ANALYSIS TYPES
// ============================================

export interface PositionBreakdown {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  K: number;
  DEF: number;
  [key: string]: number;
}

export interface PositionChange {
  position: string;
  before: number;
  after: number;
  change: number;
}

export interface TeamTradeAnalysis {
  rosterId: string;
  rosterName: string;

  // Players
  tradingAway: PlayerTradeValue[];
  acquiring: PlayerTradeValue[];

  // Roster changes
  rosterBefore: PositionBreakdown;
  rosterAfter: PositionBreakdown;
  positionChanges: PositionChange[];

  // Keeper impact
  keeperSlotsBefore: number;
  keeperSlotsAfter: number;
  keeperSlotsMax: number;
  keeperValueLost: number;
  keeperValueGained: number;
  netKeeperValue: number;

  // Draft capital
  picksGiven: DraftPickValue[];
  picksReceived: DraftPickValue[];
  draftCapitalChange: number;

  // Totals
  totalValueGiven: number;
  totalValueReceived: number;
  netValue: number;
}

// ============================================
// TRADE ANALYSIS RESULT
// ============================================

export interface TradeFact {
  category: "keeper" | "roster" | "draft" | "value";
  description: string;
}

export interface TradeSummary {
  fairnessScore: number; // 0-100, 50 = perfectly fair
  valueDifferential: number;
  facts: TradeFact[];
}

export interface TradeAnalysisResult {
  success: boolean;
  tradeDate: string;
  isAfterDeadline: boolean;
  season: number;

  team1: TeamTradeAnalysis;
  team2: TeamTradeAnalysis;

  summary: TradeSummary;
}

// ============================================
// INPUT TYPES
// ============================================

export interface TradeInput {
  team1RosterId: string;
  team2RosterId: string;
  team1Players: string[]; // Player IDs team1 is giving
  team2Players: string[]; // Player IDs team2 is giving
  team1Picks: { season: number; round: number }[];
  team2Picks: { season: number; round: number }[];
  tradeDate?: Date; // Optional, defaults to current date
}

// ============================================
// VALUE CONSTANTS
// ============================================

export const BASE_POSITION_VALUES: Record<string, number> = {
  QB: 25,
  RB: 30,
  WR: 28,
  TE: 20,
  K: 5,
  DEF: 8,
};

export const DRAFT_PICK_BASE_VALUE = 32; // Round 1 value
export const DRAFT_PICK_DECAY = 4; // Value lost per round
export const DRAFT_PICK_MIN_VALUE = 2;
export const FUTURE_SEASON_DISCOUNT = 0.1; // 10% discount per year out
