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
 * Get the keeper deadline description
 */
export function getKeeperDeadlineInfo(): {
  isActive: boolean;
  message: string;
} {
  const month = new Date().getMonth();
  const season = getCurrentSeason();

  if (month >= 1 && month <= 7) {
    return {
      isActive: true,
      message: `${season} Keeper selections are open`,
    };
  } else if (month >= 8 && month <= 11) {
    return {
      isActive: false,
      message: `${season} Season in progress - keepers locked`,
    };
  } else {
    return {
      isActive: false,
      message: `${season} Playoffs - keepers locked`,
    };
  }
}
