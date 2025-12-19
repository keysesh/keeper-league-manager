import {
  SleeperPlayer,
  SleeperRoster,
  SleeperLeagueUser,
  SleeperLeague,
  SleeperDraftPick,
  SleeperTransaction,
  SleeperTradedPick,
} from "./types";
import { LeagueStatus, DraftStatus, TransactionType, Prisma } from "@prisma/client";

// ============================================
// PLAYER MAPPERS
// ============================================

export function mapSleeperPlayer(player: SleeperPlayer) {
  return {
    firstName: player.first_name || null,
    lastName: player.last_name || null,
    fullName:
      player.full_name ||
      `${player.first_name || ""} ${player.last_name || ""}`.trim() ||
      "Unknown",
    position: player.position || null,
    team: player.team || null,
    age: player.age || null,
    yearsExp: player.years_exp || null,
    status: player.status || null,
    injuryStatus: player.injury_status || null,
    searchRank: player.search_rank || null,
    fantasyPositions: player.fantasy_positions || [],
    metadata: player.metadata
      ? (player.metadata as Prisma.InputJsonValue)
      : Prisma.JsonNull,
  };
}

// ============================================
// ROSTER MAPPERS
// ============================================

export function mapSleeperRoster(
  roster: SleeperRoster,
  user?: SleeperLeagueUser
) {
  return {
    ownerId: roster.owner_id || null,
    teamName: user?.metadata?.team_name || user?.display_name || null,
    wins: roster.settings?.wins || 0,
    losses: roster.settings?.losses || 0,
    ties: roster.settings?.ties || 0,
    pointsFor:
      (roster.settings?.fpts || 0) +
      (roster.settings?.fpts_decimal || 0) / 100,
    pointsAgainst:
      (roster.settings?.fpts_against || 0) +
      (roster.settings?.fpts_against_decimal || 0) / 100,
    settings: roster.settings
      ? (roster.settings as Prisma.InputJsonValue)
      : Prisma.JsonNull,
  };
}

// ============================================
// LEAGUE MAPPERS
// ============================================

export function mapSleeperLeagueStatus(status: string): LeagueStatus {
  switch (status) {
    case "pre_draft":
      return LeagueStatus.PRE_DRAFT;
    case "drafting":
      return LeagueStatus.DRAFTING;
    case "in_season":
      return LeagueStatus.IN_SEASON;
    case "complete":
      return LeagueStatus.COMPLETE;
    default:
      return LeagueStatus.PRE_DRAFT;
  }
}

export function mapSleeperLeague(league: SleeperLeague) {
  return {
    name: league.name,
    season: parseInt(league.season),
    previousLeagueId: league.previous_league_id || null,
    status: mapSleeperLeagueStatus(league.status),
    totalRosters: league.total_rosters,
    draftRounds: 16, // Default, can be updated from draft settings
    settings: league.settings
      ? (league.settings as Prisma.InputJsonValue)
      : Prisma.JsonNull,
  };
}

// ============================================
// DRAFT MAPPERS
// ============================================

export function mapSleeperDraftStatus(status: string): DraftStatus {
  switch (status) {
    case "pre_draft":
      return DraftStatus.PRE_DRAFT;
    case "drafting":
      return DraftStatus.DRAFTING;
    case "complete":
      return DraftStatus.COMPLETE;
    default:
      return DraftStatus.PRE_DRAFT;
  }
}

export function mapSleeperDraftPick(pick: SleeperDraftPick, draftId: string) {
  return {
    round: pick.round,
    pickNumber: pick.pick_no,
    draftSlot: pick.draft_slot,
    metadata: pick.metadata
      ? (pick.metadata as Prisma.InputJsonValue)
      : Prisma.JsonNull,
  };
}

// ============================================
// TRANSACTION MAPPERS
// ============================================

export function mapSleeperTransactionType(type: string): TransactionType {
  switch (type) {
    case "trade":
      return TransactionType.TRADE;
    case "waiver":
      return TransactionType.WAIVER;
    case "free_agent":
      return TransactionType.FREE_AGENT;
    case "commissioner":
      return TransactionType.COMMISSIONER;
    default:
      return TransactionType.FREE_AGENT;
  }
}

export function mapSleeperTransaction(transaction: SleeperTransaction) {
  const metadata = {
    roster_ids: transaction.roster_ids,
    waiver_budget: transaction.waiver_budget,
    settings: transaction.settings,
  };
  return {
    type: mapSleeperTransactionType(transaction.type),
    status: transaction.status,
    week: transaction.week,
    createdAt: new Date(transaction.created),
    metadata: JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue,
  };
}

// ============================================
// TRADED PICKS MAPPERS
// ============================================

export function mapSleeperTradedPick(pick: SleeperTradedPick) {
  return {
    season: parseInt(pick.season),
    round: pick.round,
    originalOwnerId: String(pick.owner_id), // Original owner
    currentOwnerId: String(pick.roster_id), // Current owner
  };
}
