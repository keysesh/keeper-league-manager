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
 * NFLverse Fantasy Projections
 * Source: https://github.com/nflverse/nflverse-data/releases/download/projections/projections_{season}.csv
 */
export interface NFLVerseProjection {
  // Identifiers
  player_id?: string;        // GSIS ID
  player_name: string;
  position?: string;
  team?: string;

  // ID mappings
  gsis_id?: string;
  sleeper_id?: string;
  espn_id?: string;
  yahoo_id?: string;

  // Season context
  season?: number;
  week?: number;             // 0 = full season projection

  // Projected stats
  pass_att?: number;
  pass_cmp?: number;
  pass_yds?: number;
  pass_td?: number;
  pass_int?: number;
  rush_att?: number;
  rush_yds?: number;
  rush_td?: number;
  rec?: number;
  rec_yds?: number;
  rec_td?: number;

  // Fantasy projections from different sources
  fantasy_points?: number;
  fantasy_points_ppr?: number;

  // Source-specific projections (may vary by file)
  espn_fantasy_points?: number;
  yahoo_fantasy_points?: number;
  fantasypros_points?: number;
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

/**
 * FantasyPros Rankings from DynastyProcess
 * Source: https://raw.githubusercontent.com/dynastyprocess/data/master/files/fp_latest_weekly.csv
 */
export interface FFRanking {
  page: string;
  page_pos: string;
  scrape_date: string;
  fantasypros_id: string;
  player_name: string;
  pos: string;
  team: string;
  rank: number;
  ecr: number;              // Expert Consensus Ranking
  sd: number;               // Standard Deviation
  best: number;
  worst: number;
  // Mapped IDs (from db_playerids.csv)
  sleeper_id?: string;
  gsis_id?: string;
}

/**
 * Player ID mapping from DynastyProcess
 * Source: https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv
 */
export interface PlayerIdMapping {
  mfl_id?: string;
  sportradar_id?: string;
  fantasypros_id?: string;
  gsis_id?: string;
  pff_id?: string;
  sleeper_id?: string;
  nfl_id?: string;
  espn_id?: string;
  yahoo_id?: string;
  fleaflicker_id?: string;
  cbs_id?: string;
  pfr_id?: string;
  cfbref_id?: string;
  rotowire_id?: string;
  rotoworld_id?: string;
  ktc_id?: string;
  stats_id?: string;
  stats_global_id?: string;
  fantasy_data_id?: string;
  swish_id?: string;
  name?: string;
  merge_name?: string;
  position?: string;
  team?: string;
  age?: number;
  draft_year?: number;
  draft_round?: string;
  draft_pick?: string;
  draft_ovr?: number;
  twitter_username?: string;
  height?: number;
  weight?: number;
  college?: string;
  db_season?: number;
}

/**
 * NFLverse Depth Chart Entry
 * Source: https://github.com/nflverse/nflverse-data/releases/download/depth_charts/depth_charts_{season}.csv
 */
export interface DepthChart {
  season: number;
  club_code: string;
  week: number;
  game_type: string;
  depth_team: number;
  last_name: string;
  first_name: string;
  football_name: string;
  formation: string;
  gsis_id?: string;
  jersey_number?: number;
  position: string;
  elias_id?: string;
  depth_position?: number;
  full_name?: string;
}

/**
 * NFLverse Injury Report
 * Source: https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_{season}.csv
 */
export interface Injury {
  season: number;
  game_type: string;
  team: string;
  week: number;
  gsis_id?: string;
  full_name: string;
  first_name: string;
  last_name: string;
  report_primary_injury: string;
  report_secondary_injury?: string;
  report_status: string;         // Out, Doubtful, Questionable, Probable
  practice_primary_injury?: string;
  practice_secondary_injury?: string;
  practice_status?: string;
  date_modified?: string;
}

/**
 * Stored ranking data in Player metadata
 */
export interface RankingMetadata {
  ecr?: number;                  // Expert Consensus Ranking
  positionRank?: number;         // Position-specific rank (e.g., RB12)
  tier?: number;                 // Tier grouping
  rankingDate?: string;          // When ranking was scraped
}

/**
 * Stored depth chart data in Player metadata
 */
export interface DepthChartMetadata {
  depthPosition?: number;        // 1 = starter, 2 = backup, etc.
  formation?: string;
  lastUpdated?: number;
}

/**
 * Stored injury data in Player metadata
 */
export interface InjuryMetadata {
  status?: string;               // Out, Doubtful, Questionable, Probable
  primaryInjury?: string;
  secondaryInjury?: string;
  practiceStatus?: string;
  lastUpdated?: number;
}

/**
 * Extended NFLverse metadata to include new data sources
 */
export interface NFLVerseMetadataExtended extends NFLVerseMetadata {
  ranking?: RankingMetadata;
  depthChart?: DepthChartMetadata;
  injury?: InjuryMetadata;
}
