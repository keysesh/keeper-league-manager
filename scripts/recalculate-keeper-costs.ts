/**
 * Recalculate Keeper Costs Script
 *
 * This script retroactively applies the corrected keeper cost logic:
 * - Uses roster time (originSeason) instead of Keeper records
 * - Franchise tags use same cost formula as regular keepers
 * - Offseason trades reset years to 0
 *
 * Run with: npx tsx scripts/recalculate-keeper-costs.ts
 */

import { PrismaClient } from "@prisma/client";
import { isTradeAfterDeadline, DEFAULT_KEEPER_RULES } from "../src/lib/constants/keeper-rules";

const prisma = new PrismaClient();

function getSeasonFromDate(date: Date): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month < 2) return year - 1;
  return year;
}

async function getOriginSeasonForOwner(
  playerId: string,
  targetSleeperId: string,
  targetSeason: number,
  rosterToSleeperMap: Map<string, string>,
  visited: Set<string>
): Promise<{ originSeason: number; draftRound?: number }> {
  const key = `${playerId}-${targetSleeperId}`;
  if (visited.has(key)) {
    return { originSeason: targetSeason };
  }
  visited.add(key);

  // Check if drafted by this owner
  const draftPick = await prisma.draftPick.findFirst({
    where: {
      playerId,
      roster: { sleeperId: targetSleeperId },
    },
    include: { draft: true },
    orderBy: { draft: { season: "asc" } },
  });

  if (draftPick) {
    return { originSeason: draftPick.draft.season, draftRound: draftPick.round };
  }

  // Find acquisition transaction
  const targetRosters = await prisma.roster.findMany({
    where: { sleeperId: targetSleeperId },
    select: { id: true },
  });
  const targetRosterIds = targetRosters.map(r => r.id);

  const transaction = await prisma.transactionPlayer.findFirst({
    where: {
      playerId,
      toRosterId: { in: targetRosterIds },
    },
    include: { transaction: true },
    orderBy: { transaction: { createdAt: "desc" } },
  });

  if (!transaction) {
    return { originSeason: targetSeason };
  }

  const txDate = transaction.transaction.createdAt;
  const txType = transaction.transaction.type;
  const txSeason = getSeasonFromDate(txDate);

  // Handle trades
  if (txType === "TRADE" && transaction.fromRosterId) {
    const fromSleeperId = rosterToSleeperMap.get(transaction.fromRosterId);
    if (fromSleeperId) {
      const previousOrigin = await getOriginSeasonForOwner(
        playerId,
        fromSleeperId,
        targetSeason,
        rosterToSleeperMap,
        visited
      );

      const isOffseasonTrade = isTradeAfterDeadline(txDate, txSeason);

      if (isOffseasonTrade) {
        // Offseason trade: reset years, preserve draft round
        return {
          originSeason: txSeason >= 8 ? txSeason + 1 : txSeason,
          draftRound: previousOrigin.draftRound
        };
      } else {
        return previousOrigin;
      }
    }
  }

  // Handle waiver/FA
  if (txType !== "TRADE" && transaction.fromRosterId) {
    const fromSleeperId = rosterToSleeperMap.get(transaction.fromRosterId);
    if (fromSleeperId) {
      const dropTx = await prisma.transactionPlayer.findFirst({
        where: {
          playerId,
          fromRosterId: transaction.fromRosterId,
        },
        include: { transaction: true },
      });

      if (dropTx) {
        const dropSeason = getSeasonFromDate(dropTx.transaction.createdAt);
        if (dropSeason === txSeason) {
          return await getOriginSeasonForOwner(
            playerId,
            fromSleeperId,
            targetSeason,
            rosterToSleeperMap,
            visited
          );
        }
      }
    }
  }

  return { originSeason: txSeason };
}

async function recalculateKeeperCosts() {
  console.log("Starting keeper cost recalculation...\n");

  // Get all keepers with their roster and player info
  const keepers = await prisma.keeper.findMany({
    include: {
      player: true,
      roster: {
        include: {
          league: { include: { keeperSettings: true } },
        },
      },
    },
  });

  console.log(`Found ${keepers.length} keeper records to process\n`);

  // Build roster -> sleeper map for all leagues
  const allRosters = await prisma.roster.findMany({
    select: { id: true, sleeperId: true, leagueId: true },
  });

  const rosterToSleeperMap = new Map<string, string>();
  for (const r of allRosters) {
    if (r.sleeperId) {
      rosterToSleeperMap.set(r.id, r.sleeperId);
    }
  }

  let updated = 0;
  let errors = 0;

  for (const keeper of keepers) {
    try {
      const settings = keeper.roster.league.keeperSettings;
      const undraftedRound = settings?.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND;
      const minRound = settings?.minimumRound ?? DEFAULT_KEEPER_RULES.MINIMUM_ROUND;
      const sleeperId = keeper.roster.sleeperId;

      if (!sleeperId) {
        console.log(`  Skipping ${keeper.player.fullName} - no sleeperId`);
        continue;
      }

      // Get origin season
      const origin = await getOriginSeasonForOwner(
        keeper.playerId,
        sleeperId,
        keeper.season,
        rosterToSleeperMap,
        new Set()
      );

      // Calculate years on roster
      const yearsOnRoster = Math.max(0, keeper.season - origin.originSeason);

      // Calculate base cost
      let baseCost: number;
      if (origin.draftRound) {
        baseCost = origin.draftRound;
      } else {
        baseCost = undraftedRound;
      }

      // Apply cost reduction for years on roster
      const newFinalCost = Math.max(minRound, baseCost - yearsOnRoster);

      if (newFinalCost !== keeper.finalCost) {
        console.log(`  ${keeper.player.fullName} (${keeper.season}): R${keeper.finalCost} → R${newFinalCost} (Year ${yearsOnRoster + 1}, base R${baseCost})`);

        await prisma.keeper.update({
          where: { id: keeper.id },
          data: { finalCost: newFinalCost },
        });
        updated++;
      }
    } catch (err) {
      console.error(`  Error processing ${keeper.player.fullName}:`, err);
      errors++;
    }
  }

  console.log(`\nRecalculation complete!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Unchanged: ${keepers.length - updated - errors}`);
}

recalculateKeeperCosts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
