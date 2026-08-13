/**
 * Shared types for the keeper planning workspace.
 * Shapes match the responses of:
 *  - /api/leagues/[leagueId]/rosters/[rosterId]/eligible-keepers
 *  - /api/leagues/[leagueId]/keepers/cascade
 *  - /api/leagues/[leagueId]/draft-picks
 */

export interface KeeperPlayer {
  id: string;
  sleeperId: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  team: string | null;
  age: number | null;
  yearsExp: number | null;
  injuryStatus: string | null;
  fantasyPointsPpr: number | null;
  fantasyPointsHalfPpr: number | null;
  gamesPlayed: number | null;
  pointsPerGame: number | null;
  lastSeasonPpg: number | null;
  lastSeasonGames: number | null;
  prevSeasonPpg: number | null;
  prevSeasonGames: number | null;
  lastSeason: number;
  prevSeason: number;
}

export interface EligiblePlayer {
  player: KeeperPlayer;
  isStarter: boolean;
  eligibility: {
    isEligible: boolean;
    reason: string | null;
    yearsKept: number;
    consecutiveYears: number;
    acquisitionType: string;
    originalDraft: {
      draftYear: number;
      draftRound: number;
    } | null;
  };
  costs: {
    franchise: {
      baseCost: number;
      finalCost: number;
      costBreakdown: string;
    } | null;
    regular: {
      baseCost: number;
      finalCost: number;
      costBreakdown: string;
    } | null;
  };
  existingKeeper: {
    id: string;
    type: string;
    finalCost: number;
    isLocked: boolean;
  } | null;
}

export interface RosterData {
  rosterId: string;
  season: number;
  players: EligiblePlayer[];
  currentKeepers: {
    franchise: number;
    regular: number;
    total: number;
  };
  limits: {
    maxKeepers: number;
    maxFranchiseTags: number;
    maxRegularKeepers: number;
  };
  canAddMore: {
    franchise: boolean;
    regular: boolean;
    any: boolean;
  };
}

export interface CascadeKeeperResult {
  playerId: string; // Sleeper ID
  playerName: string;
  finalCost: number;
  baseCost: number;
  cascaded: boolean;
}

export interface CascadeData {
  season: number;
  draftRounds: number;
  cascade: Array<{
    rosterId: string;
    rosterName: string | null;
    results: CascadeKeeperResult[];
    tradedAwayPicks: number[];
    acquiredPicks: Array<{ round: number; fromRosterId: string }>;
  }>;
}

export interface DraftPick {
  season: number;
  round: number;
  originalOwnerSleeperId: string;
  currentOwnerSleeperId: string;
  originalOwnerName: string;
  currentOwnerRosterId: string;
}

export interface DraftPicksData {
  season: number;
  picks: DraftPick[];
  allPicks?: DraftPick[];
  rosters: Array<{
    id: string;
    sleeperId: string | null;
    teamName: string | null;
  }>;
}
