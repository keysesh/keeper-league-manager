/**
 * Recalculate Keeper Years
 *
 * This script recalculates yearsKept for all keepers based on continuous ownership.
 *
 * Rule: If the same owner (by sleeperId) kept a player in consecutive seasons,
 * yearsKept should increment (Year 1, Year 2, Year 3, etc.)
 *
 * Note: This doesn't account for offseason trades - those are handled separately
 * by the wasOwnedAtSeasonEnd check during sync.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface KeeperFix {
  player: string;
  season: number;
  roster: string;
  oldYears: number;
  newYears: number;
}

async function recalculateKeeperYears() {
  console.log("=== Recalculating Keeper Years ===\n");

  // Get ALL leagues in the E Pluribus chain (they have different IDs per season)
  const leagues = await prisma.league.findMany({
    where: { name: { contains: "E Pluribus" } },
  });

  if (leagues.length === 0) {
    console.log("No leagues found!");
    return;
  }

  const leagueIds = leagues.map((l) => l.id);
  console.log(`Found ${leagues.length} league seasons: ${leagueIds.join(", ")}\n`);

  // Get all keepers across ALL seasons/leagues, grouped by player
  const keepers = await prisma.keeper.findMany({
    where: { roster: { leagueId: { in: leagueIds } } },
    include: { player: true, roster: true },
    orderBy: [
      { playerId: "asc" },
      { season: "asc" },
    ],
  });

  console.log(`Total keepers: ${keepers.length}\n`);

  // Group by player
  const playerKeepers = new Map<string, typeof keepers>();
  for (const k of keepers) {
    const existing = playerKeepers.get(k.playerId) || [];
    existing.push(k);
    playerKeepers.set(k.playerId, existing);
  }

  const fixes: KeeperFix[] = [];
  const dryRun = process.argv.includes("--dry-run");

  for (const [, playerKeeperList] of playerKeepers) {
    // Sort by season
    playerKeeperList.sort((a, b) => a.season - b.season);

    let lastSleeperId: string | null = null;
    let lastSeason: number | null = null;
    let currentYears = 0;

    for (const keeper of playerKeeperList) {
      const sleeperId = keeper.roster?.sleeperId;

      // Check if this is continuous ownership
      if (
        sleeperId &&
        sleeperId === lastSleeperId &&
        lastSeason !== null &&
        keeper.season === lastSeason + 1
      ) {
        // Same owner, consecutive season - increment years
        currentYears++;
      } else {
        // Different owner or gap - reset to Year 1
        currentYears = 1;
      }

      // Check if yearsKept needs updating
      if (keeper.yearsKept !== currentYears) {
        fixes.push({
          player: keeper.player?.fullName || "Unknown",
          season: keeper.season,
          roster: keeper.roster?.teamName || "Unknown",
          oldYears: keeper.yearsKept,
          newYears: currentYears,
        });

        if (!dryRun) {
          await prisma.keeper.update({
            where: { id: keeper.id },
            data: { yearsKept: currentYears },
          });
        }
      }

      lastSleeperId = sleeperId || null;
      lastSeason = keeper.season;
    }
  }

  console.log(`\n=== RESULTS ===\n`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "APPLIED"}`);
  console.log(`Keepers needing fix: ${fixes.length}\n`);

  if (fixes.length > 0) {
    console.log("Fixes:");
    for (const fix of fixes) {
      console.log(
        `  ${fix.player} (${fix.season}) on ${fix.roster}: Year ${fix.oldYears} -> Year ${fix.newYears}`
      );
    }

    if (dryRun) {
      console.log("\nRun without --dry-run to apply fixes.");
    } else {
      console.log("\nFixes applied!");
    }
  }

  await prisma.$disconnect();
}

recalculateKeeperYears().catch(console.error);
