import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";
import { SyncContext, createSyncResponse, createSyncError } from "../types";
import { logger } from "@/lib/logger";

const sleeper = new SleeperClient();

/**
 * Lightweight transaction sync - only syncs transactions for a single league
 * Designed to complete within Vercel's 10 second timeout
 * Uses batch operations to minimize database round trips
 */
export async function handleSyncTransactions(
  context: SyncContext,
  body: Record<string, unknown>
) {
  const { leagueId } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required", 400);
  }

  // Single query: Get league with rosters and all players (for mapping)
  const [league, allPlayers, existingTransactions] = await Promise.all([
    prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        id: true,
        sleeperId: true,
        season: true,
        rosters: {
          select: { id: true, sleeperId: true }
        }
      },
    }),
    prisma.player.findMany({
      select: { id: true, sleeperId: true }
    }),
    prisma.transaction.findMany({
      where: { leagueId },
      select: { sleeperId: true }
    })
  ]);

  if (!league) {
    return createSyncError("League not found", 404);
  }

  // Build maps for fast lookup
  const rosterMap = new Map<string, string>();
  for (const roster of league.rosters) {
    if (roster.sleeperId) {
      rosterMap.set(roster.sleeperId, roster.id);
    }
  }

  const playerMap = new Map<string, string>();
  for (const player of allPlayers) {
    playerMap.set(player.sleeperId, player.id);
  }

  const existingTxIds = new Set(existingTransactions.map(t => t.sleeperId));

  // Fetch transactions from Sleeper - include week 0 for offseason trades
  const [round0, round1, round2, round3] = await Promise.all([
    sleeper.getTransactions(league.sleeperId, 0).catch(() => []),  // Offseason
    sleeper.getTransactions(league.sleeperId, 1).catch(() => []),
    sleeper.getTransactions(league.sleeperId, 2).catch(() => []),
    sleeper.getTransactions(league.sleeperId, 3).catch(() => []),
  ]);

  const allTransactions = [...round0, ...round1, ...round2, ...round3];

  // Filter to trades only, and only new ones
  const newTrades = allTransactions
    .filter((tx: { type: string; transaction_id?: string; created: number }) => {
      if (tx.type !== "trade") return false;
      const sleeperId = tx.transaction_id || `trade-${tx.created}`;
      return !existingTxIds.has(sleeperId);
    });

  // Count trades by source for debugging
  const totalTrades = allTransactions.filter((t: {type: string}) => t.type === "trade").length;

  if (newTrades.length === 0) {
    return createSyncResponse({
      success: true,
      message: "No new trades to sync",
      data: {
        created: 0,
        existingTrades: totalTrades,
        totalTransactions: allTransactions.length,
        byWeek: {
          week0: round0.length,
          week1: round1.length,
          week2: round2.length,
          week3: round3.length,
        }
      },
    });
  }

  // Batch create all transactions and their players
  let created = 0;

  for (const tx of newTrades) {
    try {
      const sleeperId = tx.transaction_id || `trade-${tx.created}`;

      // Create transaction with players in a single transaction
      await prisma.$transaction(async (prisma) => {
        const transaction = await prisma.transaction.create({
          data: {
            sleeperId,
            leagueId: league.id,
            type: "TRADE",
            status: tx.status || "complete",
            createdAt: new Date(tx.created),
            week: tx.leg || null,
          },
        });

        // Batch create all player records
        const playerRecords: Array<{
          transactionId: string;
          playerId: string;
          toRosterId: string | null;
          fromRosterId: string | null;
        }> = [];

        if (tx.adds) {
          for (const [sleeperPlayerId, rosterId] of Object.entries(tx.adds)) {
            const dbPlayerId = playerMap.get(sleeperPlayerId);
            const dbRosterId = rosterMap.get(String(rosterId));
            if (!dbPlayerId || !dbRosterId) continue;

            // Find who gave up the player
            let fromRosterId: string | null = null;
            if (tx.drops) {
              for (const [dropPlayerId, dropRosterId] of Object.entries(tx.drops)) {
                if (dropPlayerId === sleeperPlayerId) {
                  fromRosterId = rosterMap.get(String(dropRosterId)) || null;
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
          await prisma.transactionPlayer.createMany({
            data: playerRecords,
          });
        }
      });

      created++;
    } catch (err) {
      logger.warn("Failed to process transaction", { error: err });
    }
  }

  // Update last synced timestamp
  await prisma.league.update({
    where: { id: league.id },
    data: { lastSyncedAt: new Date() },
  });

  return createSyncResponse({
    success: true,
    message: `Synced ${created} trades`,
    data: { created, total: newTrades.length },
  });
}
