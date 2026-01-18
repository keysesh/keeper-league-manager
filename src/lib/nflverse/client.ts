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
  FFRanking,
  PlayerIdMapping,
  DepthChart,
  Injury,
} from "./types";

// NFLverse GitHub releases base URL
const NFLVERSE_BASE_URL =
  "https://github.com/nflverse/nflverse-data/releases/download";

// DynastyProcess data URLs (for FantasyPros rankings and ID mappings)
const DYNASTYPROCESS_BASE_URL =
  "https://raw.githubusercontent.com/dynastyprocess/data/master/files";

// Cache TTLs in milliseconds
const CACHE_TTL = {
  rosters: 7 * 24 * 60 * 60 * 1000,   // 7 days
  stats: 24 * 60 * 60 * 1000,         // 24 hours
  players: 7 * 24 * 60 * 60 * 1000,   // 7 days
  rankings: 6 * 60 * 60 * 1000,       // 6 hours (rankings update frequently)
  depthCharts: 24 * 60 * 60 * 1000,   // 24 hours
  injuries: 2 * 60 * 60 * 1000,       // 2 hours (injuries update during week)
  playerIds: 7 * 24 * 60 * 60 * 1000, // 7 days (ID mappings rarely change)
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
   * Get weekly player stats for a season (legacy - use getSeasonStats instead)
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
   * Get pre-aggregated season stats from NFLverse stats_player release
   * This is the preferred method - data is already aggregated by NFLverse
   * URL: stats_player/stats_player_regpost_{season}.csv
   */
  async getSeasonStats(
    season: number,
    gsisId?: string
  ): Promise<NFLVerseSeasonStats[]> {
    // Use the pre-aggregated stats_player data (regular + postseason combined)
    const url = `${NFLVERSE_BASE_URL}/stats_player/stats_player_regpost_${season}.csv`;

    interface StatsPlayerRow {
      player_id: string;
      player_name: string;
      player_display_name: string;
      position: string;
      recent_team: string;
      season: number;
      season_type: string;
      games: number;
      completions: number;
      attempts: number;
      passing_yards: number;
      passing_tds: number;
      passing_interceptions: number;
      sacks_suffered: number;
      passing_first_downs: number;
      carries: number;
      rushing_yards: number;
      rushing_tds: number;
      rushing_first_downs: number;
      receptions: number;
      targets: number;
      receiving_yards: number;
      receiving_tds: number;
      receiving_yards_after_catch: number;
      receiving_first_downs: number;
      rushing_fumbles: number;
      rushing_fumbles_lost: number;
      receiving_fumbles: number;
      receiving_fumbles_lost: number;
      sack_fumbles: number;
      sack_fumbles_lost: number;
      fantasy_points: number;
      fantasy_points_ppr: number;
    }

    const rawStats = await this.fetchCSV<StatsPlayerRow>(
      url,
      `stats_player_regpost_${season}`,
      CACHE_TTL.stats
    );

    // Filter by gsis_id if provided, and only include REG or REG+POST rows
    const filteredStats = rawStats.filter((row) => {
      if (gsisId && row.player_id !== gsisId) return false;
      // Include regular season stats (REG or REG+POST combined)
      return row.season_type === "REG" || row.season_type === "REG+POST";
    });

    // Convert to our NFLVerseSeasonStats format
    return filteredStats.map((row) => ({
      player_id: row.player_id,
      player_name: row.player_display_name || row.player_name,
      position: row.position,
      team: row.recent_team,
      season: row.season || season,
      games_played: row.games || 0,
      completions: row.completions || 0,
      attempts: row.attempts || 0,
      passing_yards: row.passing_yards || 0,
      passing_tds: row.passing_tds || 0,
      interceptions: row.passing_interceptions || 0,
      sacks: row.sacks_suffered || 0,
      passing_first_downs: row.passing_first_downs || 0,
      carries: row.carries || 0,
      rushing_yards: row.rushing_yards || 0,
      rushing_tds: row.rushing_tds || 0,
      rushing_first_downs: row.rushing_first_downs || 0,
      receptions: row.receptions || 0,
      targets: row.targets || 0,
      receiving_yards: row.receiving_yards || 0,
      receiving_tds: row.receiving_tds || 0,
      receiving_yards_after_catch: row.receiving_yards_after_catch || 0,
      receiving_first_downs: row.receiving_first_downs || 0,
      fumbles:
        (row.rushing_fumbles || 0) +
        (row.receiving_fumbles || 0) +
        (row.sack_fumbles || 0),
      fumbles_lost:
        (row.rushing_fumbles_lost || 0) +
        (row.receiving_fumbles_lost || 0) +
        (row.sack_fumbles_lost || 0),
      fantasy_points_ppr: row.fantasy_points_ppr || 0,
    }));
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

  /**
   * Get player ID mappings from DynastyProcess
   * Maps fantasypros_id, gsis_id, sleeper_id, etc.
   */
  async getPlayerIdMappings(): Promise<PlayerIdMapping[]> {
    const url = `${DYNASTYPROCESS_BASE_URL}/db_playerids.csv`;
    return this.fetchCSV<PlayerIdMapping>(
      url,
      "player_id_mappings",
      CACHE_TTL.playerIds
    );
  }

  /**
   * Build a mapping from fantasypros_id to sleeper_id
   */
  async buildFantasyProsToSleeperMapping(): Promise<Map<string, string>> {
    const mappings = await this.getPlayerIdMappings();
    const map = new Map<string, string>();

    for (const mapping of mappings) {
      if (mapping.fantasypros_id && mapping.sleeper_id) {
        map.set(mapping.fantasypros_id, mapping.sleeper_id);
      }
    }

    logger.info("Built FantasyPros to Sleeper ID mapping", {
      mappedPlayers: map.size,
    });

    return map;
  }

  /**
   * Get FantasyPros rankings from DynastyProcess
   * Returns latest weekly rankings with ECR (Expert Consensus Ranking)
   */
  async getFFRankings(): Promise<FFRanking[]> {
    const url = `${DYNASTYPROCESS_BASE_URL}/fp_latest_weekly.csv`;

    interface RawFFRanking {
      page: string;
      page_pos: string;
      scrape_date: string;
      fantasypros_id: string;
      player_name: string;
      pos: string;
      team: string;
      rank: number;
      ecr: number;
      sd: number;
      best: number;
      worst: number;
    }

    const rawRankings = await this.fetchCSV<RawFFRanking>(
      url,
      "ff_rankings",
      CACHE_TTL.rankings
    );

    // Get ID mappings to add sleeper_id
    const fpToSleeper = await this.buildFantasyProsToSleeperMapping();
    const mappings = await this.getPlayerIdMappings();

    // Build fantasypros_id to gsis_id mapping
    const fpToGsis = new Map<string, string>();
    for (const m of mappings) {
      if (m.fantasypros_id && m.gsis_id) {
        fpToGsis.set(m.fantasypros_id, m.gsis_id);
      }
    }

    // Enrich rankings with IDs
    return rawRankings.map((r) => ({
      ...r,
      sleeper_id: fpToSleeper.get(r.fantasypros_id),
      gsis_id: fpToGsis.get(r.fantasypros_id),
    }));
  }

  /**
   * Get depth charts for a season
   * Contains player depth position by team/position
   */
  async getDepthCharts(season: number): Promise<DepthChart[]> {
    const url = `${NFLVERSE_BASE_URL}/depth_charts/depth_charts_${season}.csv`;
    return this.fetchCSV<DepthChart>(
      url,
      `depth_charts_${season}`,
      CACHE_TTL.depthCharts
    );
  }

  /**
   * Get latest depth chart entry for each player (most recent week)
   * Returns only the most current depth chart position per player
   */
  async getLatestDepthCharts(season: number): Promise<Map<string, DepthChart>> {
    const depthCharts = await this.getDepthCharts(season);
    const latestByPlayer = new Map<string, DepthChart>();

    // Sort by week descending to get latest first
    const sorted = [...depthCharts].sort((a, b) => b.week - a.week);

    for (const dc of sorted) {
      if (dc.gsis_id && !latestByPlayer.has(dc.gsis_id)) {
        latestByPlayer.set(dc.gsis_id, dc);
      }
    }

    logger.info("Built latest depth chart mapping", {
      season,
      playersWithDepth: latestByPlayer.size,
    });

    return latestByPlayer;
  }

  /**
   * Get injury reports for a season
   * Note: 2025 data may not be available until season starts
   */
  async getInjuries(season: number): Promise<Injury[]> {
    const url = `${NFLVERSE_BASE_URL}/injuries/injuries_${season}.csv`;

    try {
      return await this.fetchCSV<Injury>(
        url,
        `injuries_${season}`,
        CACHE_TTL.injuries
      );
    } catch (error) {
      // Injuries file may not exist for future/current seasons
      logger.warn("Injuries data not available", { season, error });
      return [];
    }
  }

  /**
   * Get latest injury status for each player (most recent week)
   */
  async getLatestInjuries(season: number): Promise<Map<string, Injury>> {
    const injuries = await this.getInjuries(season);
    const latestByPlayer = new Map<string, Injury>();

    // Sort by week descending to get latest first
    const sorted = [...injuries].sort((a, b) => b.week - a.week);

    for (const inj of sorted) {
      if (inj.gsis_id && !latestByPlayer.has(inj.gsis_id)) {
        latestByPlayer.set(inj.gsis_id, inj);
      }
    }

    logger.info("Built latest injury mapping", {
      season,
      playersWithInjuries: latestByPlayer.size,
    });

    return latestByPlayer;
  }
}

// Export singleton instance
export const nflverseClient = new NFLVerseClient();
