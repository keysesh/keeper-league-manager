/**
 * Keeper League Rules and Constants
 *
 * These are the default rules - can be overridden by league settings
 */

// Default keeper limits
export const DEFAULT_KEEPER_RULES = {
  MAX_KEEPERS: 7,
  MAX_FRANCHISE_TAGS: 2,
  MAX_REGULAR_KEEPERS: 5,
  REGULAR_KEEPER_MAX_YEARS: 2,
  UNDRAFTED_ROUND: 10,
  MINIMUM_ROUND: 1,
  COST_REDUCTION_PER_YEAR: 1,
  MAX_DRAFT_ROUNDS: 16,
  TRADE_DEADLINE_WEEK: 11, // Trades after this week reset keeper value
} as const;

// Visual indicators for UI
export const KEEPER_INDICATORS = {
  FRANCHISE_TAG: "🏷️",
  REGULAR_KEEPER: "📌",
  TRADED: "🔄",
  YEAR_0: "⓪",
  YEAR_1: "①",
  YEAR_2: "②",
  CASCADE: "⤵️",
  CONFLICT: "⚠️",
  ELIGIBLE: "✓",
  INELIGIBLE: "❌",
} as const;

// Color scheme for keeper types
export const KEEPER_COLORS = {
  FRANCHISE_TAG: "#9333ea", // Purple
  REGULAR_KEEPER: "#3b82f6", // Blue
  YEAR_0: "#22d3ee", // Cyan (new keeper)
  YEAR_1: "#f59e0b", // Orange (second year)
  YEAR_2: "#ef4444", // Red (expiring)
  CASCADE_WARNING: "#fbbf24", // Amber
  OCCUPIED_SLOT: "#fee2e2", // Light red
  AVAILABLE_SLOT: "#dcfce7", // Light green
  SUCCESS: "#10b981", // Green
  ERROR: "#ef4444", // Red
} as const;

/**
 * Get the current NFL season year
 */
export function getCurrentSeason(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0 = January)
  const year = now.getFullYear();

  // NFL season logic:
  // - January/February: Still in previous year's season (playoffs)
  // - March-August: Offseason, preparing for current year
  // - September+: Current year's season
  if (month < 2) {
    return year - 1; // January/February = previous season
  }
  return year;
}

/**
 * Get the season for keeper planning/draft prep
 *
 * Keeper planning is always for the NEXT season's draft:
 * - During the season (Sept-Feb): planning for next year's draft
 * - During offseason (Mar-Aug): planning for current year's draft
 *
 * Example: In Dec 2025, we're prepping for the 2026 draft
 */
export function getKeeperPlanningSeason(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();

  // Sept-Dec: Planning for next year's draft
  if (month >= 8) {
    return year + 1;
  }
  // Jan-Feb: Still planning for current year's draft (playoffs ongoing)
  if (month < 2) {
    return year;
  }
  // Mar-Aug: Planning for current year's draft
  return year;
}

/**
 * Get available season options for selection
 */
export function getSeasonOptions(): number[] {
  const current = getCurrentSeason();
  // Show 3 years back and 1 year forward
  return [current - 3, current - 2, current - 1, current, current + 1];
}

/**
 * Check if we're in the offseason (keeper selection period)
 */
export function isOffseason(): boolean {
  const month = new Date().getMonth();
  // February through August is offseason/keeper selection time
  return month >= 1 && month <= 7;
}

/**
 * Check if we're in draft season
 */
export function isDraftSeason(): boolean {
  const month = new Date().getMonth();
  // August and September are typically draft months
  return month >= 7 && month <= 8;
}

/**
 * Get the keeper deadline description and date
 */
export function getKeeperDeadlineInfo(): {
  isActive: boolean;
  message: string;
  deadline: Date | null;
  deadlineLabel: string | null;
} {
  const now = new Date();
  const month = now.getMonth();
  const season = getCurrentSeason();

  if (month >= 1 && month <= 7) {
    // Keeper deadline is typically August 31st before the season starts
    const deadline = new Date(now.getFullYear(), 7, 31, 23, 59, 59); // August 31st
    return {
      isActive: true,
      message: `${season} Keeper selections are open`,
      deadline,
      deadlineLabel: "August 31st",
    };
  } else if (month >= 8 && month <= 11) {
    return {
      isActive: false,
      message: `${season} Season in progress - keepers locked`,
      deadline: null,
      deadlineLabel: null,
    };
  } else {
    return {
      isActive: false,
      message: `${season} Playoffs - keepers locked`,
      deadline: null,
      deadlineLabel: null,
    };
  }
}

/**
 * Check if a trade date falls after the trade deadline for a given season
 *
 * Trade deadline is typically around week 11 (late November)
 * - Trades BEFORE deadline: keeper value is preserved (original draft round, years kept)
 * - Trades AFTER deadline (offseason): keeper value resets (undrafted round, 0 years kept)
 *
 * NFL Season timeline:
 * - Season 2024 = Sept 2024 - Feb 2025
 * - Trade deadline = ~Nov 2024 (week 11)
 * - Offseason = Dec 2024 - Aug 2025
 * - Draft = typically Aug 2025 (for 2025 season)
 *
 * For keeper purposes, a trade in the "offseason" (after deadline) means:
 * - The player's keeper value resets for the NEW owner
 * - They start fresh as a Year 1 keeper
 *
 * @param tradeDate - The date the trade occurred
 * @param season - The NFL season year the trade is being evaluated against
 * @param deadlineWeek - The week number of the trade deadline (default: 11)
 * @returns true if the trade was after the deadline (value should reset)
 */
export function isTradeAfterDeadline(
  tradeDate: Date,
  season: number,
  deadlineWeek: number = DEFAULT_KEEPER_RULES.TRADE_DEADLINE_WEEK
): boolean {
  const tradeMonth = tradeDate.getMonth(); // 0-indexed (0=Jan, 11=Dec)
  const tradeYear = tradeDate.getFullYear();

  // Calculate approximate deadline date
  // NFL Week 1 starts around Sept 7, so week 11 starts around Nov 16
  const deadlineMonth = 10; // November (0-indexed)
  const deadlineDay = 7 + (deadlineWeek - 1) * 7; // Approximate day in November

  // NFL Season runs Sept [YEAR] - Feb [YEAR+1]
  // Example: 2024 season = Sept 2024 - Feb 2025
  // Trade deadline for 2024 season = mid-Nov 2024
  //
  // A trade is AFTER deadline if:
  // 1. Same calendar year as season, after Nov deadline (Dec trades)
  // 2. Next calendar year, before Sept (Jan-Aug = offseason)
  //
  // A trade is BEFORE deadline if:
  // 1. Same calendar year, Sept-Nov (before deadline day)

  if (tradeYear === season) {
    // Trade in same year as season (e.g., trade in 2024, season 2024)
    if (tradeMonth < 8) {
      // Jan-Aug of season year = this is actually OFFSEASON from PREVIOUS season
      // Example: Trade in March 2024 is offseason for 2023 season, not 2024
      // But we're evaluating against 2024 season, so this trade happened
      // BEFORE the 2024 season even started - treat as before deadline
      return false;
    }
    if (tradeMonth >= 8 && tradeMonth < deadlineMonth) {
      // Sept-Oct = in-season, before deadline
      return false;
    }
    if (tradeMonth === deadlineMonth) {
      // November - check specific day
      return tradeDate.getDate() > deadlineDay;
    }
    // December = after deadline
    return true;
  }

  if (tradeYear === season + 1) {
    // Trade in next calendar year (e.g., trade in 2025, season 2024)
    if (tradeMonth < 2) {
      // Jan-Feb = playoffs/offseason, after deadline
      return true;
    }
    if (tradeMonth <= 7) {
      // March-Aug = offseason, after deadline
      return true;
    }
    // Sept+ = new season started, this trade is for a different season context
    return false;
  }

  // Trade year is before season year - historical trade
  // This shouldn't normally happen, but preserve value
  return false;
}
