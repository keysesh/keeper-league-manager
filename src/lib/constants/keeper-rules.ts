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
  UNDRAFTED_ROUND: 8, // Waiver/FA pickups without a draft position that season cost Round 8
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

// NOTE: the old getKeeperDeadlineInfo() (hardcoded Aug 31 + Sept-Dec lock)
// was removed — keeper deadline state now comes from real league data via
// lib/keeper/deadline.ts (league-configured deadline, or Sleeper draft
// start as a clearly-labeled fallback).

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

  // Calculate the actual trade deadline date using calendar math
  // NFL Week 1 starts the Thursday after Labor Day (first Monday of September)
  // Trade deadline is the Tuesday of the deadline week
  const sept1 = new Date(season, 8, 1); // September 1 of the season year
  const dayOfWeek = sept1.getDay(); // 0=Sun, 1=Mon, ...
  const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const laborDayDate = 1 + daysToMonday; // Day of month for Labor Day
  // Tuesday of deadline week = Labor Day + 1 (Tue) + (deadlineWeek - 1) * 7
  const deadlineDaySept = laborDayDate + 1 + (deadlineWeek - 1) * 7;
  // Date constructor handles month overflow (e.g., Sept 73 → Nov 12)
  const deadlineDateObj = new Date(season, 8, deadlineDaySept);

  // NFL Season runs Sept [YEAR] - Feb [YEAR+1]
  // Example: 2024 season = Sept 2024 - Feb 2025
  // Trade deadline for 2024 season = mid-Nov 2024

  if (tradeYear === season) {
    // Trade in same year as season (e.g., trade in 2024, season 2024)
    if (tradeMonth < 8) {
      // Jan-Aug of season year = this is actually OFFSEASON from PREVIOUS season
      // Example: Trade in March 2024 is offseason for 2023 season, not 2024
      // But we're evaluating against 2024 season, so this trade happened
      // BEFORE the 2024 season even started - treat as before deadline
      return false;
    }
    // Sept onwards: compare against computed deadline date
    return tradeDate.getTime() > deadlineDateObj.getTime();
  }

  if (tradeYear === season + 1) {
    // Any date in the calendar year AFTER the season is past that season's
    // November deadline — January through December alike. The month ladder
    // that used to live here carved out September onwards on the assumption
    // that a September trade must belong to a new season; that is the caller's
    // job to decide, and governingSeasonForTrade decides it from the real
    // draft dates. Keeping the carve-out meant a 2 Sep 2026 trade, two days
    // before the 2026 draft, came back "before the 2025 deadline" — which is
    // ten months wrong.
    return true;
  }

  // Trade year is before season year - historical trade
  // This shouldn't normally happen, but preserve value
  return false;
}

/**
 * Would a trade executed RIGHT NOW reset keeper value (years kept)?
 *
 * The season whose trade deadline governs a trade made today:
 * - Sept-Dec: the season currently being played (this calendar year)
 * - Jan-Aug: the season just played (previous calendar year) — any trade
 *   in that window is an offseason trade relative to the last deadline,
 *   so keeper value resets for the new owner.
 *
 * Examples:
 * - Oct 2026  → evaluates vs 2026 deadline (mid-Nov) → false (preserved)
 * - Dec 2026  → evaluates vs 2026 deadline           → true  (reset)
 * - Mar 2027  → evaluates vs 2026 season             → true  (offseason reset)
 * - Aug 2027  → evaluates vs 2026 season             → true  (still offseason)
 * - Sept 2027 → evaluates vs 2027 deadline           → false (new season, pre-deadline)
 */
/**
 * Which season's trade deadline governs a trade made at `tradeDate`?
 *
 * The offseason runs from a season's trade deadline to the NEXT draft, so the
 * governing season is simply the season of the most recent draft already
 * started. Anything after that draft belongs to that season; anything before
 * it is still the previous season's offseason.
 *
 * This has to come from the drafts, not the calendar. The obvious shortcut —
 * "September onwards is the new season" — is wrong for any league that drafts
 * in September: a trade on 2 Sep 2026, two days before the 2026 draft, is an
 * offseason trade under the 2025 deadline, but the month test calls it an
 * in-season 2026 trade and preserves keeper years that should have reset.
 *
 * Falls back to the month rule only when no draft dates are known.
 */
export function governingSeasonForTrade(
  tradeDate: Date,
  draftStarts: ReadonlyArray<{ season: number; startTime: Date | null }>
): number {
  const started = draftStarts
    .filter((d): d is { season: number; startTime: Date } => d.startTime !== null)
    .filter((d) => d.startTime.getTime() <= tradeDate.getTime())
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

  if (started.length > 0) return started[0].season;

  const month = tradeDate.getMonth();
  return month >= 8 ? tradeDate.getFullYear() : tradeDate.getFullYear() - 1;
}

export function isCurrentlyAfterTradeDeadline(
  now: Date = new Date(),
  deadlineWeek: number = DEFAULT_KEEPER_RULES.TRADE_DEADLINE_WEEK
): boolean {
  const month = now.getMonth();
  const year = now.getFullYear();
  const governingSeason = month >= 8 ? year : year - 1;
  return isTradeAfterDeadline(now, governingSeason, deadlineWeek);
}
