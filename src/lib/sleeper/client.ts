import {
  SleeperUser,
  SleeperLeague,
  SleeperRoster,
  SleeperLeagueUser,
  SleeperDraft,
  SleeperDraftPick,
  SleeperPlayer,
  SleeperTransaction,
  SleeperTradedPick,
  SleeperNFLState,
} from "./types";
import { logger } from "@/lib/logger";
import {
  SLEEPER_RATE_LIMIT_PER_MINUTE,
  RETRY_DELAY_MS,
  MAX_RETRIES,
  NFL_SEASON_WEEKS,
  SLEEPER_CACHE_TTL_SECONDS,
} from "@/lib/constants";

const SLEEPER_BASE_URL =
  process.env.SLEEPER_API_BASE_URL || "https://api.sleeper.app/v1";

interface RateLimitConfig {
  maxRequestsPerMinute: number;
  retryDelayMs: number;
  maxRetries: number;
}

/**
 * Sleeper API Client with rate limiting and retry logic
 */
export class SleeperClient {
  private requestCount = 0;
  private windowStart = Date.now();
  private config: RateLimitConfig = {
    maxRequestsPerMinute: SLEEPER_RATE_LIMIT_PER_MINUTE,
    retryDelayMs: RETRY_DELAY_MS,
    maxRetries: MAX_RETRIES,
  };

  /**
   * Throttle requests to stay within rate limits
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    if (now - this.windowStart > 60000) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    if (this.requestCount >= this.config.maxRequestsPerMinute) {
      const waitTime = 60000 - (now - this.windowStart);
      logger.debug("Rate limit reached, waiting", { waitTimeMs: waitTime });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.windowStart = Date.now();
      this.requestCount = 0;
    }

    this.requestCount++;
  }

  /**
   * Make a fetch request with rate limiting and retry logic
   */
  private async fetch<T>(
    endpoint: string,
    retryCount = 0
  ): Promise<T> {
    await this.throttle();

    try {
      const response = await fetch(`${SLEEPER_BASE_URL}${endpoint}`, {
        headers: {
          Accept: "application/json",
        },
        next: {
          revalidate: SLEEPER_CACHE_TTL_SECONDS,
        },
      });

      if (!response.ok) {
        if (response.status === 429 && retryCount < this.config.maxRetries) {
          // Rate limited - wait and retry
          const delay = this.config.retryDelayMs * Math.pow(2, retryCount);
          logger.warn("Rate limited by Sleeper API, retrying", { delayMs: delay, attempt: retryCount + 1 });
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.fetch(endpoint, retryCount + 1);
        }

        if (response.status >= 500 && retryCount < this.config.maxRetries) {
          // Server error - retry with exponential backoff
          const delay = this.config.retryDelayMs * Math.pow(2, retryCount);
          logger.warn("Sleeper API server error, retrying", { status: response.status, delayMs: delay });
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.fetch(endpoint, retryCount + 1);
        }

        throw new Error(`Sleeper API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (
        retryCount < this.config.maxRetries &&
        error instanceof Error &&
        (error.message.includes("timeout") || error.message.includes("network"))
      ) {
        const delay = this.config.retryDelayMs * Math.pow(2, retryCount);
        logger.warn("Network error, retrying", { delayMs: delay, error: error.message });
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetch(endpoint, retryCount + 1);
      }
      throw error;
    }
  }

  // ============================================
  // USER ENDPOINTS
  // ============================================

  /**
   * Get user by username
   */
  async getUser(username: string): Promise<SleeperUser | null> {
    try {
      return await this.fetch<SleeperUser>(`/user/${username}`);
    } catch {
      return null;
    }
  }

  /**
   * Get user by user_id
   */
  async getUserById(userId: string): Promise<SleeperUser | null> {
    try {
      return await this.fetch<SleeperUser>(`/user/${userId}`);
    } catch {
      return null;
    }
  }

  /**
   * Get all leagues for a user in a specific season
   */
  async getUserLeagues(userId: string, season: number): Promise<SleeperLeague[]> {
    return this.fetch<SleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`);
  }

  // ============================================
  // LEAGUE ENDPOINTS
  // ============================================

  /**
   * Get league details
   */
  async getLeague(leagueId: string): Promise<SleeperLeague> {
    return this.fetch<SleeperLeague>(`/league/${leagueId}`);
  }

  /**
   * Get all rosters in a league
   */
  async getRosters(leagueId: string): Promise<SleeperRoster[]> {
    return this.fetch<SleeperRoster[]>(`/league/${leagueId}/rosters`);
  }

  /**
   * Get all users in a league
   */
  async getUsers(leagueId: string): Promise<SleeperLeagueUser[]> {
    return this.fetch<SleeperLeagueUser[]>(`/league/${leagueId}/users`);
  }

  /**
   * Get traded picks in a league
   */
  async getTradedPicks(leagueId: string): Promise<SleeperTradedPick[]> {
    return this.fetch<SleeperTradedPick[]>(`/league/${leagueId}/traded_picks`);
  }

  // ============================================
  // DRAFT ENDPOINTS
  // ============================================

  /**
   * Get all drafts for a league
   */
  async getDrafts(leagueId: string): Promise<SleeperDraft[]> {
    return this.fetch<SleeperDraft[]>(`/league/${leagueId}/drafts`);
  }

  /**
   * Get all picks in a draft
   */
  async getDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
    return this.fetch<SleeperDraftPick[]>(`/draft/${draftId}/picks`);
  }

  // ============================================
  // TRANSACTION ENDPOINTS
  // ============================================

  /**
   * Get transactions for a specific week
   */
  async getTransactions(leagueId: string, week: number): Promise<SleeperTransaction[]> {
    return this.fetch<SleeperTransaction[]>(`/league/${leagueId}/transactions/${week}`);
  }

  /**
   * Get all transactions for a league (all weeks)
   */
  async getAllTransactions(leagueId: string): Promise<SleeperTransaction[]> {
    const allTransactions: SleeperTransaction[] = [];

    // Fetch all weeks in NFL season
    for (let week = 1; week <= NFL_SEASON_WEEKS; week++) {
      try {
        const weekTransactions = await this.getTransactions(leagueId, week);
        if (weekTransactions && weekTransactions.length > 0) {
          allTransactions.push(...weekTransactions);
        }
      } catch {
        // Week might not exist yet, continue
        break;
      }
    }

    return allTransactions;
  }

  // ============================================
  // PLAYER ENDPOINTS
  // ============================================

  /**
   * Get all NFL players (large payload ~5MB, cache aggressively)
   */
  async getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
    return this.fetch<Record<string, SleeperPlayer>>("/players/nfl");
  }

  /**
   * Get trending players (adds/drops)
   */
  async getTrendingPlayers(
    type: "add" | "drop",
    lookbackHours = 24,
    limit = 25
  ): Promise<Array<{ player_id: string; count: number }>> {
    return this.fetch(
      `/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`
    );
  }

  // ============================================
  // NFL STATE
  // ============================================

  /**
   * Get current NFL state (week, season, etc.)
   */
  async getNFLState(): Promise<SleeperNFLState> {
    return this.fetch<SleeperNFLState>("/state/nfl");
  }
}

// Export singleton instance
export const sleeperClient = new SleeperClient();
