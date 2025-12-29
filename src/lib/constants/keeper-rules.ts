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
 * FIXED: Dynamic season calculation
 * No more hardcoded years like 2023/2024/2025
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
 * @param tradeDate - The date the trade occurred
 * @param season - The NFL season year (e.g., 2024 for the 2024-2025 season)
 * @param deadlineWeek - The week number of the trade deadline (default: 11)
 * @returns true if the trade was after the deadline (value should reset)
 */
export function isTradeAfterDeadline(
  tradeDate: Date,
  season: number,
  deadlineWeek: number = DEFAULT_KEEPER_RULES.TRADE_DEADLINE_WEEK
): boolean {
  // NFL season typically starts first week of September
  // Week 1 is usually the first Thursday after Labor Day
  // We approximate: Season starts September 7th (week 1)
  // Trade deadline at week 11 = approximately mid-November

  const tradeMonth = tradeDate.getMonth(); // 0-indexed
  const tradeYear = tradeDate.getFullYear();

  // If trade is in the offseason (Jan-Aug of the following year, or Dec-Feb)
  // it's after the deadline

  // Season runs Sept-Feb: 2024 season = Sept 2024 - Feb 2025
  // Deadline is ~week 11 = mid-November of the season year

  // Calculate approximate deadline date
  // Week 1 starts around Sept 7, so week 11 starts around Nov 16
  const deadlineMonth = 10; // November (0-indexed)
  const deadlineDay = 7 + (deadlineWeek - 1) * 7; // Approximate

  // Trade is after deadline if:
  // 1. Same year as season and after November deadline
  // 2. Next year (offseason trades in Jan-Aug)

  if (tradeYear === season) {
    // Same year as season
    if (tradeMonth > deadlineMonth) {
      // December - after deadline
      return true;
    }
    if (tradeMonth === deadlineMonth && tradeDate.getDate() > deadlineDay) {
      // Late November - after deadline
      return true;
    }
    // Before or during deadline week
    return false;
  }

  if (tradeYear === season + 1) {
    // Next calendar year
    if (tradeMonth <= 7) {
      // Jan-Aug of next year = offseason, after deadline
      return true;
    }
    // Sept+ of next year = new season, not applicable
    return false;
  }

  // Trade year doesn't match season year - likely historical
  // Default to before deadline to preserve value
  return false;
}
