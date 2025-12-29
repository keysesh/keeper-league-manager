/**
 * Application Constants
 * Centralized configuration values to avoid magic numbers throughout the codebase
 */

// ============================================
// RATE LIMITING
// ============================================

/** Maximum requests per minute to Sleeper API (their limit is ~100, we use conservative value) */
export const SLEEPER_RATE_LIMIT_PER_MINUTE = 60;

/** Base delay in milliseconds for retry logic */
export const RETRY_DELAY_MS = 1000;

/** Maximum number of retries for failed API requests */
export const MAX_RETRIES = 3;

// ============================================
// NFL SEASON
// ============================================

/** Number of weeks in NFL season (regular + playoffs) */
export const NFL_SEASON_WEEKS = 18;

/** Default number of draft rounds */
export const DEFAULT_DRAFT_ROUNDS = 16;

/** Maximum seasons to sync for historical data */
export const MAX_HISTORICAL_SEASONS = 10;

// ============================================
// DATABASE OPERATIONS
// ============================================

/** Batch size for bulk database operations */
export const DB_BATCH_SIZE = 100;

/** Progress logging interval for large operations */
export const PROGRESS_LOG_INTERVAL = 1000;

// ============================================
// KEEPER SETTINGS DEFAULTS
// ============================================

export const DEFAULT_KEEPER_SETTINGS = {
  maxKeepers: 7,
  maxFranchiseTags: 2,
  maxRegularKeepers: 5,
  regularKeeperMaxYears: 2,
  undraftedRound: 8,
  minimumRound: 1,
  costReductionPerYear: 1,
} as const;

// ============================================
// PAGINATION
// ============================================

/** Default page size for list queries */
export const DEFAULT_PAGE_SIZE = 50;

/** Maximum page size allowed */
export const MAX_PAGE_SIZE = 100;

// ============================================
// CACHE
// ============================================

/** Next.js fetch cache revalidation time in seconds */
export const SLEEPER_CACHE_TTL_SECONDS = 300; // 5 minutes

// ============================================
// SERVERLESS
// ============================================

/** Maximum duration for serverless functions in seconds (Vercel Pro required for >10s) */
export const SERVERLESS_MAX_DURATION = 60;
