import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";
import { SyncContext, createSyncResponse, createSyncError } from "../types";
import { logger } from "@/lib/logger";

const sleeper = new SleeperClient();

/**
 * Lightweight transaction sync - only syncs transactions for a single league
 * Designed to complete within Vercel's 10 second timeout
 */
export async function handleSyncTransactions(
  context: SyncContext,
  body: Record<string, unknown>
) {
  const { leagueId } = body;

  if (!leagueId || typeof leagueId !== "string") {
    return createSyncError("leagueId is required", 400);
  }

  // Get league info
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      sleeperId: true,
      season: true,
      rosters: {
        select: { id: true, sleeperId: true }
      }
    },
  });

  if (!league) {
    return createSyncError("League not found", 404);
  }

  // Build roster mapping
  const rosterMap = new Map<string, string>();
  for (const roster of league.rosters) {
    if (roster.sleeperId) {
      rosterMap.set(roster.sleeperId, roster.id);
    }
  }

  // Fetch transactions from Sleeper (trades only for speed)
  const transactions = await sleeper.getTransactions(league.sleeperId, 1); // Round 1 = offseason

  let created = 0;
  let skipped = 0;

  // Process only TRADE transactions
  const trades = transactions.filter((tx: { type: string }) => tx.type === "trade");

  for (const tx of trades) {
    try {
      const sleeperId = tx.transaction_id || `trade-${tx.created}`;

      // Check if transaction already exists
      const existing = await prisma.transaction.findFirst({
        where: {
          sleeperId,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create transaction
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

      // Process adds (players received)
      if (tx.adds) {
        for (const [playerId, rosterId] of Object.entries(tx.adds)) {
          const dbRosterId = rosterMap.get(String(rosterId));
          if (!dbRosterId) continue;

          // Find player
          const player = await prisma.player.findFirst({
            where: { sleeperId: playerId },
          });
          if (!player) continue;

          // Find who gave up the player
          let fromRosterId: string | null = null;
          if (tx.drops) {
            for (const [dropPlayerId, dropRosterId] of Object.entries(tx.drops)) {
              if (dropPlayerId === playerId) {
                fromRosterId = rosterMap.get(String(dropRosterId)) || null;
                break;
              }
            }
          }

          await prisma.transactionPlayer.create({
            data: {
              transactionId: transaction.id,
              playerId: player.id,
              toRosterId: dbRosterId,
              fromRosterId,
            },
          });
        }
      }

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
    message: `Synced ${created} trades, skipped ${skipped} existing`,
    data: { created, skipped, total: trades.length },
  });
}
