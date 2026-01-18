/**
 * NFLverse API Client
 * Fetches data from NFLverse GitHub releases (CSV files)
 * https://github.com/nflverse/nflverse-data
 */

import { parse } from "csv-parse/sync";
import { logger } from "@/lib/logger";
import {
  NFLVerseRoster,
  NFLVersePlayerStats,
  NFLVerseSeasonStats,
  NFLVerseProjection,
  NFLVerseCacheEntry,
} from "./types";

// NFLverse GitHub releases base URL
const NFLVERSE_BASE_URL =
  "https://github.com/nflverse/nflverse-data/releases/download";

// Cache TTLs in milliseconds
const CACHE_TTL = {
  rosters: 7 * 24 * 60 * 60 * 1000, // 7 days
  stats: 24 * 60 * 60 * 1000,       // 24 hours
  players: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// In-memory cache for CSV data
const cache = new Map<string, NFLVerseCacheEntry<unknown>>();

/**
 * NFLverse Client for fetching NFL data
 */
export class NFLVerseClient {
  private retryDelayMs = 1000;
  private maxRetries = 3;

  /**
   * Fetch CSV from NFLverse and parse it
   */
  private async fetchCSV<T>(
    url: string,
    cacheKey: string,
    cacheTtl: number
  ): Promise<T[]> {
    // Check cache first
    const cached = cache.get(cacheKey) as NFLVerseCacheEntry<T[]> | undefined;
    if (cached && Date.now() < cached.expiresAt) {
      logger.debug("NFLverse cache hit", { cacheKey });
      return cached.data;
    }

    logger.info("Fetching NFLverse data", { url, cacheKey });

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            Accept: "text/csv,application/csv,*/*",
            "User-Agent": "KeeperLeagueManager/1.0",
          },
          // Follow redirects (GitHub releases redirect to Azure blob storage)
          redirect: "follow",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const csvText = await response.text();

        // Parse CSV with csv-parse
        const records = parse(csvText, {
          columns: true,           // Use first row as headers
          skip_empty_lines: true,
          trim: true,
          cast: (value, context) => {
            // Auto-cast numeric values
            if (context.header) return value;
            if (value === "" || value === "NA" || value === "null") return null;
            const num = Number(value);
            if (!isNaN(num) && value !== "") return num;
            return value;
          },
        }) as T[];

        // Cache the result
        cache.set(cacheKey, {
          data: records,
          timestamp: Date.now(),
          expiresAt: Date.now() + cacheTtl,
        });

        logger.info("NFLverse data fetched successfully", {
          cacheKey,
          recordCount: records.length,
        });

        return records;
      } catch (error) {
        lastError = error as Error;
        logger.warn("NFLverse fetch failed, retrying", {
          attempt: attempt + 1,
          error: lastError.message,
        });

        if (attempt < this.maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelayMs * (attempt + 1))
          );
        }
      }
    }

    logger.error("NFLverse fetch failed after all retries", {
      url,
      error: lastError?.message,
    });

    throw lastError || new Error("Failed to fetch NFLverse data");
  }

  /**
   * Get roster data with ID mappings for a season
   * Contains sleeper_id, gsis_id, espn_id, headshot_url, etc.
   */
  async getRosters(season: number): Promise<NFLVerseRoster[]> {
    const url = `${NFLVERSE_BASE_URL}/rosters/roster_${season}.csv`;
    return this.fetchCSV<NFLVerseRoster>(
      url,
      `rosters_${season}`,
      CACHE_TTL.rosters
    );
  }

  /**
   * Get weekly player stats for a season
   * Contains passing, rushing, receiving yards/TDs
   */
  async getPlayerStats(season: number): Promise<NFLVersePlayerStats[]> {
    const url = `${NFLVERSE_BASE_URL}/player_stats/player_stats_${season}.csv`;
    return this.fetchCSV<NFLVersePlayerStats>(
      url,
      `player_stats_${season}`,
      CACHE_TTL.stats
    );
  }

  /**
   * Get aggregated season stats for a player
   * Sums weekly stats into season totals
   */
  async getSeasonStats(
    season: number,
    gsisId?: string
  ): Promise<NFLVerseSeasonStats[]> {
    const weeklyStats = await this.getPlayerStats(season);

    // Group by player and aggregate
    const playerMap = new Map<string, NFLVerseSeasonStats>();

    for (const week of weeklyStats) {
      // Filter by specific player if gsisId provided
      if (gsisId && week.player_id !== gsisId) continue;

      const playerId = week.player_id;
      if (!playerId) continue;

      let stats = playerMap.get(playerId);
      if (!stats) {
        stats = {
          player_id: playerId,
          player_name: week.player_name || "",
          position: week.position,
          team: week.recent_team,
          season,
          games_played: 0,
          // Passing
          completions: 0,
          attempts: 0,
          passing_yards: 0,
          passing_tds: 0,
          interceptions: 0,
          sacks: 0,
          passing_first_downs: 0,
          // Rushing
          carries: 0,
          rushing_yards: 0,
          rushing_tds: 0,
          rushing_first_downs: 0,
          // Receiving
          receptions: 0,
          targets: 0,
          receiving_yards: 0,
          receiving_tds: 0,
          receiving_yards_after_catch: 0,
          receiving_first_downs: 0,
          // Fumbles
          fumbles: 0,
          fumbles_lost: 0,
          // Fantasy
          fantasy_points_ppr: 0,
        };
        playerMap.set(playerId, stats);
      }

      // Only count regular season games
      if (week.season_type === "REG") {
        stats.games_played += 1;
      }

      // Aggregate stats
      stats.completions += week.completions || 0;
      stats.attempts += week.attempts || 0;
      stats.passing_yards += week.passing_yards || 0;
      stats.passing_tds += week.passing_tds || 0;
      stats.interceptions += week.interceptions || 0;
      stats.sacks += week.sacks || 0;
      stats.passing_first_downs += week.passing_first_downs || 0;

      stats.carries += week.carries || 0;
      stats.rushing_yards += week.rushing_yards || 0;
      stats.rushing_tds += week.rushing_tds || 0;
      stats.rushing_first_downs += week.rushing_first_downs || 0;

      stats.receptions += week.receptions || 0;
      stats.targets += week.targets || 0;
      stats.receiving_yards += week.receiving_yards || 0;
      stats.receiving_tds += week.receiving_tds || 0;
      stats.receiving_yards_after_catch += week.receiving_yards_after_catch || 0;
      stats.receiving_first_downs += week.receiving_first_downs || 0;

      stats.fumbles +=
        (week.rushing_fumbles || 0) +
        (week.receiving_fumbles || 0) +
        (week.sack_fumbles || 0);
      stats.fumbles_lost +=
        (week.rushing_fumbles_lost || 0) +
        (week.receiving_fumbles_lost || 0) +
        (week.sack_fumbles_lost || 0);

      stats.fantasy_points_ppr += week.fantasy_points_ppr || 0;

      // Update team to most recent
      if (week.recent_team) {
        stats.team = week.recent_team;
      }
    }

    return Array.from(playerMap.values());
  }

  /**
   * Get fantasy projections for a season
   * Contains projected fantasy points from various sources (ESPN, Yahoo, etc.)
   */
  async getProjections(season: number): Promise<NFLVerseProjection[]> {
    const url = `${NFLVERSE_BASE_URL}/projections/projections_${season}.csv`;
    return this.fetchCSV<NFLVerseProjection>(
      url,
      `projections_${season}`,
      CACHE_TTL.stats
    );
  }

  /**
   * Find a player by Sleeper ID and get their NFLverse data
   */
  async findPlayerBySleeperId(
    sleeperId: string,
    season: number
  ): Promise<{
    roster: NFLVerseRoster | null;
    stats: NFLVerseSeasonStats | null;
  }> {
    const rosters = await this.getRosters(season);
    const roster = rosters.find((r) => r.sleeper_id === sleeperId) || null;

    let stats: NFLVerseSeasonStats | null = null;
    if (roster?.gsis_id) {
      const seasonStats = await this.getSeasonStats(season, roster.gsis_id);
      stats = seasonStats[0] || null;
    }

    return { roster, stats };
  }

  /**
   * Build a mapping from Sleeper ID to NFLverse data
   * Returns a Map for efficient lookups
   */
  async buildSleeperIdMapping(
    season: number
  ): Promise<Map<string, NFLVerseRoster>> {
    const rosters = await this.getRosters(season);
    const map = new Map<string, NFLVerseRoster>();

    for (const roster of rosters) {
      if (roster.sleeper_id) {
        map.set(roster.sleeper_id, roster);
      }
    }

    logger.info("Built Sleeper ID mapping", {
      season,
      mappedPlayers: map.size,
    });

    return map;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    cache.clear();
    logger.info("NFLverse cache cleared");
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(key: string): void {
    cache.delete(key);
  }

  /**
   * Get the most recent NFL season with available data
   * NFL season X runs Sept X - Feb X+1, data available during/after
   */
  static getCurrentSeason(): number {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    // Before September, the previous year's season is the most recent with full data
    // September onwards, current year's season is in progress
    return month >= 8 ? year : year - 1;
  }

  /**
   * Get array of available NFLverse seasons (most recent first)
   * Returns last 4 seasons with data
   */
  static getAvailableSeasons(): number[] {
    const currentSeason = NFLVerseClient.getCurrentSeason();
    return [currentSeason, currentSeason - 1, currentSeason - 2, currentSeason - 3];
  }
}

// Export singleton instance
export const nflverseClient = new NFLVerseClient();
