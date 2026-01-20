import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { calculateBaseCost } from "../src/lib/keeper/calculator";

const prisma = new PrismaClient();

async function recalculateAllKeepers() {
  console.log("=== RECALCULATING ALL KEEPER BASE COSTS ===\n");

  // Get all keepers with their league settings
  const keepers = await prisma.keeper.findMany({
    include: {
      player: true,
      roster: {
        include: {
          league: {
            include: {
              keeperSettings: true,
            },
          },
        },
      },
    },
    orderBy: [{ season: "desc" }, { roster: { teamName: "asc" } }],
  });

  console.log(`Found ${keepers.length} keepers to recalculate\n`);

  let updated = 0;
  const errors: string[] = [];

  for (const keeper of keepers) {
    try {
      const settings = keeper.roster.league.keeperSettings;

      // Calculate the correct base cost
      const newBaseCost = await calculateBaseCost(
        keeper.playerId,
        keeper.rosterId,
        keeper.season,
        settings
      );

      // Check if it changed
      if (keeper.baseCost !== newBaseCost) {
        console.log(
          `${keeper.player.fullName} (${keeper.roster.teamName}, ${keeper.season}): ` +
            `R${keeper.baseCost} -> R${newBaseCost}`
        );

        await prisma.keeper.update({
          where: { id: keeper.id },
          data: { baseCost: newBaseCost },
        });

        updated++;
      }
    } catch (err) {
      const msg = `Error updating ${keeper.player.fullName}: ${err}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total keepers: ${keepers.length}`);
  console.log(`Updated: ${updated}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
  }

  // Now recalculate cascade for each league/season
  console.log("\n=== RECALCULATING CASCADE ===\n");

  const leagueSeasons = new Map<string, Set<number>>();
  for (const keeper of keepers) {
    const leagueId = keeper.roster.leagueId;
    if (!leagueSeasons.has(leagueId)) {
      leagueSeasons.set(leagueId, new Set());
    }
    leagueSeasons.get(leagueId)!.add(keeper.season);
  }

  const { recalculateAndApplyCascade } = await import("../src/lib/keeper/cascade");

  for (const [leagueId, seasons] of leagueSeasons) {
    for (const season of seasons) {
      console.log(`Recalculating cascade for league ${leagueId}, season ${season}...`);
      const result = await recalculateAndApplyCascade(leagueId, season);
      console.log(`  Updated ${result.updatedCount} final costs`);
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.join(", ")}`);
      }
    }
  }

  // Final verification
  console.log("\n=== FINAL STATE ===\n");

  const finalKeepers = await prisma.keeper.findMany({
    include: {
      player: true,
      roster: true,
    },
    orderBy: [{ season: "desc" }, { finalCost: "asc" }],
  });

  let currentSeason = 0;
  for (const k of finalKeepers) {
    if (k.season !== currentSeason) {
      currentSeason = k.season;
      console.log(`\n--- Season ${k.season} ---`);
    }
    console.log(
      `  R${k.finalCost}: ${k.player.fullName} (${k.roster.teamName}) ` +
        `[base: R${k.baseCost}, years: ${k.yearsKept}]`
    );
  }

  await prisma.$disconnect();
}

recalculateAllKeepers().catch(console.error);
