/**
 * SyncService
 *
 * Unified sync orchestrator that consolidates all sync operations.
 * Provides a clean API for the 5 main sync actions:
 * - refresh: Quick roster update (2-5s)
 * - sync: Standard full sync with drafts and trades (10-20s)
 * - syncHistory: All historical seasons (30-50s)
 * - updateKeepers: Recalculate keeper records from DB (5-15s)
 * - syncPlayers: Update all NFL players (Admin only, 10-30s)
 */

import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";
import {
  syncLeague,
  syncLeagueWithHistory,
  quickSyncLeague,
  syncAllPlayers,
  populateKeepersFromDraftPicks,
  recalculateKeeperYears,
} from "@/lib/sleeper/sync";
import { getLeagueChain } from "./league-chain";
import { logger } from "@/lib/logger";

const sleeper = new SleeperClient();

// Result types for each sync operation
export interface RefreshResult {
  success: boolean;
  message: string;
  rosters: number;
  players: number;
}

export interface SyncResult {
  success: boolean;
  message: string;
  league: { id: string; name: string };
  rosters: number;
  draftPicks: number;
  tradedPicks: number;
  transactions: number;
  keepers: { created: number; skipped: number };
}

export interface HistoryResult {
  success: boolean;
  message: string;
  seasons: Array<{ season: number; leagueId: string; name: string }>;
  totalTransactions: number;
  totalKeepers: number;
}

export interface KeeperResult {
  success: boolean;
  message: string;
  populated: { created: number; skipped: number };
  recalculated: { updated: number; total: number };
  seasonsProcessed: number;
}

export interface PlayersResult {
  success: boolean;
  message: string;
  created: number;
  updated: number;
}

/**
 * Verify user has access to a league
 */
async function verifyLeagueAccess(
  leagueId: string,
  userId: string
): Promise<boolean> {
  const roster = await prisma.roster.findFirst({
    where: {
      leagueId,
      teamMembers: {
        some: { userId },
      },
    },
  });
  return !!roster;
}

/**
 * Get league or throw error
 */
async function getLeagueOrError(leagueId: string) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, sleeperId: true, name: true },
  });

  if (!league) {
    throw new Error("League not found");
  }

  return league;
}

/**
 * Sync traded picks for a league
 */
async function syncTradedPicks(leagueId: string): Promise<number> {
  const league = await getLeagueOrError(leagueId);

  // Fetch traded picks and rosters from Sleeper API
  const [tradedPicks, sleeperRosters] = await Promise.all([
    sleeper.getTradedPicks(league.sleeperId),
    sleeper.getRosters(league.sleeperId),
  ]);

  // Build a map from Sleeper roster_id (slot 1-10) to owner_id (Sleeper user ID)
  const slotToOwnerMap = new Map<number, string>();
  for (const roster of sleeperRosters) {
    if (roster.owner_id) {
      slotToOwnerMap.set(roster.roster_id, roster.owner_id);
    }
  }

  let synced = 0;

  for (const pick of tradedPicks) {
    // Per Sleeper API: roster_id = ORIGINAL owner, owner_id = CURRENT owner
    const originalOwnerId = slotToOwnerMap.get(pick.roster_id);
    const currentOwnerId = slotToOwnerMap.get(pick.owner_id);

    if (!originalOwnerId || !currentOwnerId) {
      continue;
    }

    await prisma.tradedPick.upsert({
      where: {
        leagueId_season_round_originalOwnerId: {
          leagueId,
          season: parseInt(pick.season),
          round: pick.round,
          originalOwnerId,
        },
      },
      update: {
        currentOwnerId,
      },
      create: {
        leagueId,
        season: parseInt(pick.season),
        round: pick.round,
        originalOwnerId,
        currentOwnerId,
      },
    });

    synced++;
  }

  return synced;
}

/**
 * Sync transactions (trades) for a league
 */
async function syncTransactions(leagueId: string): Promise<number> {
  const league = await getLeagueOrError(leagueId);

  // Fetch rosters and existing transactions
  const [dbRosters, existingTransactions, allPlayers] = await Promise.all([
    prisma.roster.findMany({
      where: { leagueId },
      select: { id: true, sleeperId: true },
    }),
    prisma.transaction.findMany({
      where: { leagueId },
      select: { sleeperId: true },
    }),
    prisma.player.findMany({
      select: { id: true, sleeperId: true },
    }),
  ]);

  const rosterMap = new Map(dbRosters.map((r) => [r.sleeperId, r.id]));
  const playerMap = new Map(allPlayers.map((p) => [p.sleeperId, p.id]));
  const existingTxIds = new Set(existingTransactions.map((t) => t.sleeperId));

  // Fetch Sleeper rosters to map roster_id to owner_id
  const sleeperRosters = await sleeper.getRosters(league.sleeperId);
  const rosterIdToOwnerId = new Map<number, string>();
  for (const roster of sleeperRosters) {
    if (roster.owner_id) {
      rosterIdToOwnerId.set(roster.roster_id, roster.owner_id);
    }
  }

  // Fetch transactions from Sleeper - ALL weeks
  const weekPromises = [];
  for (let week = 0; week <= 18; week++) {
    weekPromises.push(
      sleeper.getTransactions(league.sleeperId, week).catch(() => [])
    );
  }
  const allWeeksTransactions = await Promise.all(weekPromises);
  const allTransactions = allWeeksTransactions.flat();

  // Filter to trades only and new ones
  interface SleeperTransactionLike {
    type: string;
    transaction_id?: string;
    created: number;
    status?: string;
    leg?: number;
    adds?: Record<string, number> | null;
    drops?: Record<string, number> | null;
  }

  const newTrades = allTransactions.filter((tx: SleeperTransactionLike) => {
    if (tx.type !== "trade") return false;
    const sleeperId = tx.transaction_id || `trade-${tx.created}`;
    return !existingTxIds.has(sleeperId);
  }) as SleeperTransactionLike[];

  let created = 0;

  for (const tx of newTrades as SleeperTransactionLike[]) {
    try {
      const sleeperId = tx.transaction_id || `trade-${tx.created}`;

      await prisma.$transaction(async (prismaClient) => {
        const transaction = await prismaClient.transaction.create({
          data: {
            sleeperId,
            leagueId: league.id,
            type: "TRADE",
            status: tx.status || "complete",
            createdAt: new Date(tx.created),
            week: tx.leg || null,
          },
        });

        const playerRecords: Array<{
          transactionId: string;
          playerId: string;
          toRosterId: string | null;
          fromRosterId: string | null;
        }> = [];

        if (tx.adds) {
          for (const [sleeperPlayerId, rosterIdNum] of Object.entries(tx.adds)) {
            // Convert Sleeper roster_id to owner_id, then to DB roster ID
            const ownerId = rosterIdToOwnerId.get(rosterIdNum);
            if (!ownerId) continue;

            const dbPlayerId = playerMap.get(sleeperPlayerId);
            const dbRosterId = rosterMap.get(ownerId);
            if (!dbPlayerId || !dbRosterId) continue;

            let fromRosterId: string | null = null;
            if (tx.drops) {
              for (const [dropPlayerId, dropRosterIdNum] of Object.entries(tx.drops)) {
                if (dropPlayerId === sleeperPlayerId) {
                  const dropOwnerId = rosterIdToOwnerId.get(dropRosterIdNum);
                  if (dropOwnerId) {
                    fromRosterId = rosterMap.get(dropOwnerId) || null;
                  }
                  break;
                }
              }
            }

            playerRecords.push({
              transactionId: transaction.id,
              playerId: dbPlayerId,
              toRosterId: dbRosterId,
              fromRosterId,
            });
          }
        }

        if (playerRecords.length > 0) {
          await prismaClient.transactionPlayer.createMany({
            data: playerRecords,
          });
        }
      });

      created++;
    } catch (err) {
      logger.warn("Failed to process transaction", { error: err });
    }
  }

  return created;
}

export class SyncService {
  /**
   * Refresh - Quick roster update
   *
   * Sleeper API calls:
   * - GET /league/{id}/rosters
   * - GET /league/{id}/users
   *
   * Duration: 2-5s
   * Timeout risk: None
   *
   * Use case: Daily use, check current roster
   */
  async refresh(leagueId: string, userId?: string): Promise<RefreshResult> {
    if (userId && !(await verifyLeagueAccess(leagueId, userId))) {
      throw new Error("You don't have access to this league");
    }

    logger.info("Starting refresh sync", { leagueId });

    const result = await quickSyncLeague(leagueId);

    return {
      success: true,
      message: "Rosters refreshed successfully",
      rosters: result.rosters,
      players: result.players,
    };
  }

  /**
   * Sync - Standard full sync
   *
   * Sleeper API calls:
   * - GET /league/{id} - League metadata
   * - GET /league/{id}/rosters - Current rosters
   * - GET /league/{id}/users - League members
   * - GET /league/{id}/drafts - Draft list
   * - GET /draft/{id}/picks - Draft picks (per draft)
   * - GET /league/{id}/traded_picks - Traded picks
   *
   * Duration: 10-20s
   * Timeout risk: Low
   *
   * Use case: After draft, after trades
   * Note: Transaction sync moved to sync-history to avoid Vercel timeout
   */
  async sync(leagueId: string, userId?: string): Promise<SyncResult> {
    if (userId && !(await verifyLeagueAccess(leagueId, userId))) {
      throw new Error("You don't have access to this league");
    }

    const league = await getLeagueOrError(leagueId);

    logger.info("Starting full sync", { leagueId, leagueName: league.name });

    // 1. Sync league data (rosters, drafts, picks, transactions)
    // Transactions now fetch in parallel so this is fast
    const syncResult = await syncLeague(league.sleeperId);

    // 2. Sync traded picks
    const tradedPicks = await syncTradedPicks(leagueId);

    // 3. Populate keepers from draft picks
    const keepers = await populateKeepersFromDraftPicks(leagueId);

    // 4. Recalculate keeper years
    await recalculateKeeperYears(leagueId);

    return {
      success: true,
      message: `Synced ${league.name}: ${syncResult.rosters} rosters, ${syncResult.draftPicks} draft picks, ${tradedPicks} traded picks`,
      league: syncResult.league,
      rosters: syncResult.rosters,
      draftPicks: syncResult.draftPicks,
      tradedPicks,
      transactions: 0, // Transactions synced inside syncLeague
      keepers,
    };
  }

  /**
   * Sync History - All historical seasons
   *
   * Sleeper API calls:
   * - Everything from sync, for each season
   * - Follows previous_league_id chain (max 5 seasons)
   *
   * Duration: 30-50s
   * Timeout risk: Medium
   *
   * Use case: First-time setup, troubleshooting keeper costs
   */
  async syncHistory(
    leagueId: string,
    userId?: string,
    maxSeasons = 5
  ): Promise<HistoryResult> {
    if (userId && !(await verifyLeagueAccess(leagueId, userId))) {
      throw new Error("You don't have access to this league");
    }

    const league = await getLeagueOrError(leagueId);

    logger.info("Starting history sync", {
      leagueId,
      leagueName: league.name,
      maxSeasons,
    });

    // Sync all historical seasons
    const historyResult = await syncLeagueWithHistory(
      league.sleeperId,
      maxSeasons
    );

    // Populate keepers for all synced seasons
    let totalKeepers = 0;
    for (const season of historyResult.seasons) {
      try {
        const keeperResult = await populateKeepersFromDraftPicks(
          season.leagueId
        );
        totalKeepers += keeperResult.created;

        // Recalculate keeper years for each season
        await recalculateKeeperYears(season.leagueId);
      } catch (err) {
        logger.warn(`Failed to populate keepers for ${season.season}:`, { error: err });
      }
    }

    return {
      success: true,
      message: `Synced ${historyResult.seasons.length} seasons, ${historyResult.totalTransactions} transactions, ${totalKeepers} keepers`,
      seasons: historyResult.seasons,
      totalTransactions: historyResult.totalTransactions,
      totalKeepers,
    };
  }

  /**
   * Update Keepers - Recalculate keeper records from DB
   *
   * Sleeper API calls: None (database only)
   *
   * Duration: 5-15s
   * Timeout risk: None
   *
   * Use case: Fix keeper eligibility/costs
   */
  async updateKeepers(
    leagueId: string,
    userId?: string,
    includeHistory = true
  ): Promise<KeeperResult> {
    if (userId && !(await verifyLeagueAccess(leagueId, userId))) {
      throw new Error("You don't have access to this league");
    }

    logger.info("Starting keeper update", { leagueId, includeHistory });

    // Get all leagues in the chain if includeHistory is true
    const leagueIds = includeHistory
      ? await getLeagueChain(leagueId)
      : [leagueId];

    let totalCreated = 0;
    let totalSkipped = 0;
    let totalUpdated = 0;
    let totalRecords = 0;

    // Process oldest first for correct yearsKept calculation
    for (const id of [...leagueIds].reverse()) {
      // Populate keepers from draft picks
      const populateResult = await populateKeepersFromDraftPicks(id);
      totalCreated += populateResult.created;
      totalSkipped += populateResult.skipped;

      // Recalculate keeper years
      const recalcResult = await recalculateKeeperYears(id);
      totalUpdated += recalcResult.updated;
      totalRecords += recalcResult.total;
    }

    return {
      success: true,
      message: `Processed ${leagueIds.length} season(s): created ${totalCreated}, updated ${totalUpdated} of ${totalRecords} keeper records`,
      populated: { created: totalCreated, skipped: totalSkipped },
      recalculated: { updated: totalUpdated, total: totalRecords },
      seasonsProcessed: leagueIds.length,
    };
  }

  /**
   * Sync Players - Update all NFL players (Admin only)
   *
   * Sleeper API calls:
   * - GET /players/nfl (~5MB)
   *
   * Duration: 10-30s
   * Timeout risk: Low
   *
   * Use case: Weekly admin maintenance
   */
  async syncPlayers(): Promise<PlayersResult> {
    logger.info("Starting player sync (admin)");

    const result = await syncAllPlayers();

    return {
      success: true,
      message: `Player sync complete: ${result.created} created, ${result.updated} updated`,
      created: result.created,
      updated: result.updated,
    };
  }
}

// Export singleton instance
export const syncService = new SyncService();
