/**
 * Investigate Keeper Assignment Mismatches
 *
 * Problem: When a player is drafted, dropped, then re-drafted in the same draft,
 * the keeper sync may pick up the wrong owner (first drafter instead of final owner).
 *
 * This script finds all potential mismatches by:
 * 1. Getting all keeper records
 * 2. For each keeper, checking if there's a transaction where that roster dropped the player
 * 3. If the assigned owner dropped the player, finding who actually ended up with them
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface KeeperMismatch {
  keeperId: string;
  playerId: string;
  playerName: string;
  season: number;
  assignedRosterId: string;
  assignedOwnerName: string;
  assignedOwnerId: string;
  dropDate: Date | null;
  correctRosterId: string | null;
  correctOwnerName: string | null;
  correctOwnerId: string | null;
}

async function investigateMismatches() {
  console.log("=== Investigating Keeper Assignment Mismatches ===\n");

  // Get the league ID for the main league
  const league = await prisma.league.findFirst({
    where: { name: { contains: "E Pluribus" } },
  });

  if (!league) {
    console.log("League not found!");
    return;
  }

  console.log(`League: ${league.name} (${league.id})\n`);

  // Get all keepers with their roster info
  const keepers = await prisma.keeper.findMany({
    where: {
      roster: {
        leagueId: league.id,
      },
    },
    include: {
      player: true,
      roster: true,
    },
    orderBy: [
      { season: "asc" },
      { player: { fullName: "asc" } },
    ],
  });

  console.log(`Total keepers to check: ${keepers.length}\n`);

  const mismatches: KeeperMismatch[] = [];
  const problematicSeasons = new Set<number>();

  for (const keeper of keepers) {
    const rosterId = keeper.rosterId;
    const playerId = keeper.playerId;
    const season = keeper.season;

    // Define the draft window - typically late August for each season
    // Draft happens in August before the season starts
    const draftWindowStart = new Date(season, 7, 1); // August 1
    const draftWindowEnd = new Date(season, 8, 15); // Sept 15

    // Check if the assigned roster dropped this player during the draft window
    // In this schema: TransactionPlayer with fromRosterId = rosterId means drop
    const dropTransaction = await prisma.transactionPlayer.findFirst({
      where: {
        playerId: playerId,
        fromRosterId: rosterId,
        transaction: {
          leagueId: league.id,
          createdAt: {
            gte: draftWindowStart,
            lte: draftWindowEnd,
          },
        },
      },
      include: {
        transaction: true,
      },
      orderBy: {
        transaction: {
          createdAt: "asc",
        },
      },
    });

    if (dropTransaction) {
      // The assigned owner dropped this player - this is a potential mismatch!
      // Find who picked them up after
      const pickupTransaction = await prisma.transactionPlayer.findFirst({
        where: {
          playerId: playerId,
          toRosterId: {
            not: null,
          },
          transaction: {
            leagueId: league.id,
            createdAt: {
              gt: dropTransaction.transaction.createdAt,
              lte: draftWindowEnd,
            },
          },
        },
        include: {
          transaction: true,
        },
        orderBy: {
          transaction: {
            createdAt: "asc",
          },
        },
      });

      if (pickupTransaction && pickupTransaction.toRosterId && pickupTransaction.toRosterId !== rosterId) {
        // Found a different owner who picked up the player - this is a TRUE mismatch
        // Get the correct roster info
        const correctRoster = await prisma.roster.findUnique({
          where: { id: pickupTransaction.toRosterId },
        });

        mismatches.push({
          keeperId: keeper.id,
          playerId: playerId,
          playerName: keeper.player?.fullName || "Unknown",
          season: season,
          assignedRosterId: rosterId,
          assignedOwnerName: keeper.roster?.teamName || "Unknown",
          assignedOwnerId: keeper.roster?.sleeperId || "Unknown",
          dropDate: dropTransaction.transaction.createdAt,
          correctRosterId: pickupTransaction.toRosterId,
          correctOwnerName: correctRoster?.teamName || "Unknown",
          correctOwnerId: correctRoster?.sleeperId || "Unknown",
        });
        problematicSeasons.add(season);
      }
    }
  }

  console.log(`\n=== RESULTS ===\n`);
  console.log(`Total mismatches found: ${mismatches.length}`);
  console.log(`Affected seasons: ${Array.from(problematicSeasons).sort().join(", ")}\n`);

  if (mismatches.length > 0) {
    console.log("=== MISMATCHED KEEPERS ===\n");

    for (const m of mismatches) {
      console.log(`Player: ${m.playerName}`);
      console.log(`  Season: ${m.season}`);
      console.log(`  Keeper ID: ${m.keeperId}`);
      console.log(`  WRONG Owner: ${m.assignedOwnerName} (${m.assignedOwnerId})`);
      console.log(`  CORRECT Owner: ${m.correctOwnerName} (${m.correctOwnerId})`);
      console.log(`  Drop Date: ${m.dropDate?.toISOString()}`);
      console.log("");
    }

    // Generate fix SQL/Prisma statements
    console.log("\n=== FIX STATEMENTS ===\n");
    console.log("// Run these to fix the mismatches:\n");

    for (const m of mismatches) {
      if (m.correctRosterId) {
        console.log(`// Fix ${m.playerName} (${m.season})`);
        console.log(`await prisma.keeper.update({`);
        console.log(`  where: { id: "${m.keeperId}" },`);
        console.log(`  data: { rosterId: "${m.correctRosterId}" },`);
        console.log(`});\n`);
      }
    }

    // Check for --fix flag
    if (process.argv.includes("--fix")) {
      console.log("\n=== APPLYING FIXES ===\n");

      for (const m of mismatches) {
        if (m.correctRosterId) {
          await prisma.keeper.update({
            where: { id: m.keeperId },
            data: { rosterId: m.correctRosterId },
          });
          console.log(`✓ Fixed ${m.playerName} (${m.season})`);
        }
      }

      console.log("\nAll fixes applied!");
    } else {
      console.log("\nTo auto-fix all mismatches, run with --fix flag\n");
    }
  } else {
    console.log("No mismatches found! All keeper assignments appear correct.");
  }

  await prisma.$disconnect();
}

investigateMismatches().catch(console.error);
