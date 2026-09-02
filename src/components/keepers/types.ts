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
    /** Where he was originally drafted — HISTORY, shown even when it no longer
     *  sets the price. Check `pricedFromDraft` before presenting it as the
     *  reason for the price. */
    originalDraft: {
      draftYear: number;
      draftRound: number;
    } | null;
    /** What the price counts down from: a real draft round, the league's flat
     *  undrafted round, or a commissioner override. */
    priceBasis: "DRAFT_ROUND" | "UNDRAFTED" | "OVERRIDE";
    /** True when `originalDraft` is what the price is derived from. */
    pricedFromDraft: boolean;
  };
  /**
   * Three different round numbers live in this screen; do not mix them up.
   *  - `startingRound` — the round the price counts down from
   *  - `price`         — what keeping him costs this year (the rule's answer)
   *  - `existingKeeper.finalCost` — the draft SLOT the cascade assigns, which
   *    can differ from `price` when a roster keeps two players at one price
   */
  costs: {
    franchise: {
      startingRound: number;
      price: number;
      costBreakdown: string;
    } | null;
    regular: {
      startingRound: number;
      price: number;
      costBreakdown: string;
    } | null;
  };
  existingKeeper: {
    id: string;
    type: string;
    /** The draft SLOT this keeper occupies after the cascade — NOT the price. */
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
  /** Estimated market round per player id (VOR from last-season scoring —
   *  an estimate, absent for players outside the draftable pool). */
  marketRounds?: Record<string, number>;
  keeperRules?: {
    regularKeeperMaxYears: number;
    undraftedRound: number;
  };
}

export interface CascadeKeeperResult {
  playerId: string; // Sleeper ID
  playerName: string;
  /** The draft SLOT this keeper occupies once conflicts are resolved. */
  finalCost: number;
  /** The PRICE the rules charge for him, before any slot conflict. */
  baseCost: number;
  /** True when the two above differ — he was moved off his price. */
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
