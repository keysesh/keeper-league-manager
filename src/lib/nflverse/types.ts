/**
 * NFLverse Data Types
 * Based on https://nflreadr.nflverse.com/articles/
 */

/**
 * NFLverse Roster Entry - Contains ID mappings and headshot URLs
 * Source: https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_{season}.csv
 */
export interface NFLVerseRoster {
  // Season & Team
  season: number;
  team: string;
  position: string;
  depth_chart_position?: string;
  jersey_number?: number;
  status?: string;

  // Player Info
  full_name: string;
  first_name?: string;
  last_name?: string;
  birth_date?: string;
  height?: string;
  weight?: string;
  college?: string;
  years_exp?: number;

  // ID Mappings (critical for cross-referencing)
  gsis_id?: string;        // NFL's primary ID for play-by-play
  espn_id?: string;        // ESPN API ID
  sleeper_id?: string;     // Sleeper API ID (our primary key)
  yahoo_id?: string;
  rotowire_id?: string;
  pff_id?: string;         // Pro Football Focus
  pfr_id?: string;         // Pro Football Reference
  fantasy_data_id?: string;
  sportradar_id?: string;

  // Headshot
  headshot_url?: string;   // NFL.com player photo URL

  // Draft Info
  entry_year?: number;
  rookie_year?: number;
  draft_club?: string;
  draft_number?: number;
}

/**
 * NFLverse Player Stats - Actual NFL statistics
 * Source: https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_{season}.csv
 */
export interface NFLVersePlayerStats {
  // Identifiers
  player_id: string;       // GSIS ID
  player_name: string;
  player_display_name?: string;
  position?: string;
  position_group?: string;

  // Context
  season: number;
  week: number;
  season_type?: string;    // REG, POST
  recent_team?: string;
  opponent_team?: string;

  // Passing Stats
  completions?: number;
  attempts?: number;
  passing_yards?: number;
  passing_tds?: number;
  interceptions?: number;
  sacks?: number;
  sack_yards?: number;
  sack_fumbles?: number;
  sack_fumbles_lost?: number;
  passing_air_yards?: number;
  passing_yards_after_catch?: number;
  passing_first_downs?: number;
  passing_epa?: number;
  passing_2pt_conversions?: number;

  // Rushing Stats
  carries?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  rushing_fumbles?: number;
  rushing_fumbles_lost?: number;
  rushing_first_downs?: number;
  rushing_epa?: number;
  rushing_2pt_conversions?: number;

  // Receiving Stats
  receptions?: number;
  targets?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  receiving_fumbles?: number;
  receiving_fumbles_lost?: number;
  receiving_air_yards?: number;
  receiving_yards_after_catch?: number;
  receiving_first_downs?: number;
  receiving_epa?: number;
  receiving_2pt_conversions?: number;
  target_share?: number;
  air_yards_share?: number;

  // Fantasy Points (calculated by NFLverse)
  fantasy_points?: number;
  fantasy_points_ppr?: number;
}

/**
 * Aggregated season stats (computed from weekly stats)
 */
export interface NFLVerseSeasonStats {
  player_id: string;       // GSIS ID
  player_name: string;
  position?: string;
  team?: string;
  season: number;
  games_played: number;

  // Passing
  completions: number;
  attempts: number;
  passing_yards: number;
  passing_tds: number;
  interceptions: number;
  sacks: number;
  passing_first_downs: number;

  // Rushing
  carries: number;
  rushing_yards: number;
  rushing_tds: number;
  rushing_first_downs: number;

  // Receiving
  receptions: number;
  targets: number;
  receiving_yards: number;
  receiving_tds: number;
  receiving_yards_after_catch: number;
  receiving_first_downs: number;

  // Fumbles
  fumbles: number;
  fumbles_lost: number;

  // Fantasy
  fantasy_points_ppr: number;
}

/**
 * NFLverse data stored in Player.metadata
 */
export interface NFLVerseMetadata {
  gsisId?: string;
  espnId?: string;
  pfrId?: string;
  yahooId?: string;
  headshotUrl?: string;
  lastSync?: number;       // Unix timestamp
}

/**
 * Extended Player metadata type
 */
export interface PlayerMetadata {
  nflverse?: NFLVerseMetadata;
  [key: string]: unknown;
}

/**
 * NFLverse sync result
 */
export interface NFLVerseSyncResult {
  success: boolean;
  playersUpdated: number;
  playersFailed: number;
  errors: string[];
  duration: number;
}

/**
 * Cache entry for in-memory caching
 */
export interface NFLVerseCacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}
