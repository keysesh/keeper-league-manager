// Sleeper API Response Types

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
  metadata?: Record<string, unknown>;
  is_bot?: boolean;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  season_type: string;
  sport: string;
  status: "pre_draft" | "drafting" | "in_season" | "complete";
  total_rosters: number;
  roster_positions: string[];
  settings: SleeperLeagueSettings;
  scoring_settings: Record<string, number>;
  metadata?: Record<string, unknown>;
  avatar?: string;
  previous_league_id?: string;
  draft_id?: string;
}

export interface SleeperLeagueSettings {
  max_keepers?: number;
  type?: number; // 0 = redraft, 1 = keeper, 2 = dynasty
  waiver_type?: number;
  waiver_day_of_week?: number;
  waiver_clear_days?: number;
  playoff_week_start?: number;
  playoff_teams?: number;
  num_teams?: number;
  leg?: number;
  trade_deadline?: number;
  reserve_slots?: number;
  [key: string]: unknown;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  league_id: string;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  taxi: string[] | null;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal: number;
    fpts_against: number;
    fpts_against_decimal: number;
    [key: string]: number;
  };
  metadata?: Record<string, unknown>;
  co_owners?: string[];
}

export interface SleeperLeagueUser {
  user_id: string;
  league_id: string;
  display_name: string;
  avatar: string | null;
  metadata: {
    team_name?: string;
    [key: string]: unknown;
  };
  is_owner?: boolean;
  is_bot?: boolean;
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  type: "snake" | "linear" | "auction";
  status: "pre_draft" | "drafting" | "complete";
  season: string;
  settings: {
    rounds: number;
    slots_wr: number;
    slots_rb: number;
    slots_qb: number;
    slots_te: number;
    slots_flex: number;
    slots_super_flex: number;
    slots_bn: number;
    slots_k: number;
    slots_def: number;
    pick_timer: number;
    reversal_round?: number;
    [key: string]: unknown;
  };
  draft_order: Record<string, number> | null;
  slot_to_roster_id: Record<string, number> | null;
  start_time: number | null;
  last_picked: number | null;
  last_message_id?: string;
  metadata?: Record<string, unknown>;
}

export interface SleeperDraftPick {
  player_id: string;
  picked_by: string; // roster_id
  roster_id: string;
  round: number;
  draft_slot: number;
  pick_no: number;
  metadata: {
    first_name: string;
    last_name: string;
    team: string;
    position: string;
    years_exp?: number;
    [key: string]: unknown;
  };
  is_keeper?: boolean;
  draft_id?: string;
}

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  position: string;
  team: string | null;
  age?: number;
  years_exp?: number;
  status?: string;
  injury_status?: string | null;
  fantasy_positions?: string[];
  search_rank?: number;
  search_full_name?: string;
  search_first_name?: string;
  search_last_name?: string;
  number?: number;
  depth_chart_position?: string;
  depth_chart_order?: number;
  height?: string;
  weight?: string;
  college?: string;
  active?: boolean;
  metadata?: Record<string, unknown>;
  // External IDs for cross-referencing with other data sources
  gsis_id?: string;
  espn_id?: string;
  yahoo_id?: string;
  rotowire_id?: number;
  sportradar_id?: string;
  fantasy_data_id?: number;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: "trade" | "waiver" | "free_agent" | "commissioner";
  status: string;
  status_updated: number;
  roster_ids: number[];
  week: number;
  leg: number;
  adds: Record<string, number> | null; // player_id -> roster_id
  drops: Record<string, number> | null; // player_id -> roster_id
  draft_picks: SleeperTransactionPick[];
  waiver_budget: SleeperWaiverBudget[];
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  consenter_ids?: number[];
  created: number;
}

export interface SleeperTransactionPick {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id: number;
  owner_id: number;
}

export interface SleeperWaiverBudget {
  sender: number;
  receiver: number;
  amount: number;
}

export interface SleeperTradedPick {
  season: string;
  round: number;
  roster_id: number; // current owner
  previous_owner_id: number;
  owner_id: number; // original owner
}

export interface SleeperNFLState {
  week: number;
  season_type: "pre" | "regular" | "post" | "off";
  season_start_date: string;
  season: string;
  previous_season: string;
  leg: number;
  league_season: string;
  league_create_season: string;
  display_week: number;
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number;
  points: number;
  starters: string[];
  starters_points: number[];
  players: string[];
  players_points: Record<string, number>;
  custom_points?: number;
}

export interface SleeperPlayoffMatchup {
  r: number; // Round
  m: number; // Matchup number
  t1?: number; // Team 1 roster_id
  t2?: number; // Team 2 roster_id
  t1_from?: { w?: number; l?: number }; // Team 1 advances from (winner/loser of matchup)
  t2_from?: { w?: number; l?: number }; // Team 2 advances from (winner/loser of matchup)
  w?: number; // Winner roster_id
  l?: number; // Loser roster_id
  p?: number; // Final placement position
}

// Mapped types for database
export interface MappedPlayer {
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  position: string | null;
  team: string | null;
  age: number | null;
  yearsExp: number | null;
  status: string | null;
  injuryStatus: string | null;
  searchRank: number | null;
  fantasyPositions: string[];
  metadata: Record<string, unknown> | null;
}

export interface MappedRoster {
  ownerId: string | null;
  teamName: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  settings: Record<string, unknown> | null;
}
