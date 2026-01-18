/**
 * Fix Keeper Roster Assignments
 *
 * This script fixes keeper records that are assigned to the wrong roster
 * due to the draft/drop/re-draft bug in Sleeper.
 *
 * The issue: When a player is drafted, dropped, then re-drafted in the same draft,
 * Sleeper marks the FIRST pick as isKeeper=true even though the player ended up
 * with a different owner.
 *
 * The fix: For each keeper pick, find ALL draft picks for that player in the same
 * draft, and use the LAST pick's roster (who actually ended up with the player).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface FixResult {
  player: string;
  season: number;
  oldRoster: string;
  newRoster: string;
}

async function fixKeeperRosterAssignments() {
  console.log("=== Fixing Keeper Roster Assignments ===\n");

  const league = await prisma.league.findFirst({
    where: { name: { contains: "E Pluribus" } },
  });

  if (!league) {
    console.log("League not found!");
    return;
  }

  console.log(`League: ${league.name}\n`);

  // Get all keeper picks
  const keeperPicks = await prisma.draftPick.findMany({
    where: {
      isKeeper: true,
      playerId: { not: null },
      draft: {
        leagueId: league.id,
      },
    },
    include: {
      draft: true,
      roster: true,
      player: true,
    },
    orderBy: {
      draft: { season: "asc" },
    },
  });

  console.log(`Total keeper picks to check: ${keeperPicks.length}\n`);

  const fixes: FixResult[] = [];
  let checked = 0;

  for (const pick of keeperPicks) {
    if (!pick.playerId || !pick.rosterId || !pick.roster) continue;

    checked++;
    const season = pick.draft.season;

    // Find ALL picks for this player in this draft
    const allPicksForPlayer = await prisma.draftPick.findMany({
      where: {
        playerId: pick.playerId,
        draftId: pick.draftId,
      },
      include: {
        roster: true,
      },
      orderBy: {
        pickNumber: "asc",
      },
    });

    // If only one pick, nothing to fix
    if (allPicksForPlayer.length <= 1) continue;

    // Use the LAST pick's roster as the correct owner
    const finalPick = allPicksForPlayer[allPicksForPlayer.length - 1];
    if (!finalPick?.rosterId || !finalPick.roster) continue;

    // Check if there's a mismatch
    if (finalPick.rosterId === pick.rosterId) continue;

    // There's a mismatch - the keeper pick's roster is different from final owner
    const correctRosterId = finalPick.rosterId;
    const correctRoster = finalPick.roster;

    // Check if keeper exists on the WRONG roster
    const wrongKeeper = await prisma.keeper.findFirst({
      where: {
        playerId: pick.playerId,
        rosterId: pick.rosterId,
        season: season,
      },
    });

    if (!wrongKeeper) continue;

    // Check if there's already a keeper for the CORRECT roster
    const existingCorrectKeeper = await prisma.keeper.findFirst({
      where: {
        playerId: pick.playerId,
        rosterId: correctRosterId,
        season: season,
      },
    });

    if (existingCorrectKeeper) {
      // Delete the wrong keeper since correct one exists
      console.log(
        `Deleting duplicate keeper: ${pick.player?.fullName} (${season}) - already exists on correct roster`
      );
      await prisma.keeper.delete({ where: { id: wrongKeeper.id } });
      continue;
    }

    // Move the keeper to the correct roster
    await prisma.keeper.update({
      where: { id: wrongKeeper.id },
      data: { rosterId: correctRosterId },
    });

    fixes.push({
      player: pick.player?.fullName || "Unknown",
      season,
      oldRoster: pick.roster.teamName || "Unknown",
      newRoster: correctRoster.teamName || "Unknown",
    });

    console.log(
      `Fixed: ${pick.player?.fullName} (${season}) - ${pick.roster.teamName} -> ${correctRoster.teamName}`
    );
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Checked: ${checked} keeper picks`);
  console.log(`Fixed: ${fixes.length} roster assignments\n`);

  if (fixes.length > 0) {
    console.log("Fixed keepers:");
    for (const fix of fixes) {
      console.log(`  ${fix.player} (${fix.season}): ${fix.oldRoster} -> ${fix.newRoster}`);
    }
  }

  await prisma.$disconnect();
}

// Also add a dry-run mode
async function dryRunCheck() {
  console.log("=== DRY RUN: Checking Keeper Roster Mismatches ===\n");

  const league = await prisma.league.findFirst({
    where: { name: { contains: "E Pluribus" } },
  });

  if (!league) {
    console.log("League not found!");
    return;
  }

  const keeperPicks = await prisma.draftPick.findMany({
    where: {
      isKeeper: true,
      playerId: { not: null },
      draft: {
        leagueId: league.id,
      },
    },
    include: {
      draft: true,
      roster: true,
      player: true,
    },
    orderBy: {
      draft: { season: "asc" },
    },
  });

  console.log(`Checking ${keeperPicks.length} keeper picks...\n`);

  const mismatches: {
    player: string;
    season: number;
    keeperPickRoster: string;
    finalPickRoster: string;
    hasWrongKeeper: boolean;
  }[] = [];

  for (const pick of keeperPicks) {
    if (!pick.playerId || !pick.rosterId || !pick.roster) continue;

    const allPicksForPlayer = await prisma.draftPick.findMany({
      where: {
        playerId: pick.playerId,
        draftId: pick.draftId,
      },
      include: { roster: true },
      orderBy: { pickNumber: "asc" },
    });

    if (allPicksForPlayer.length <= 1) continue;

    const finalPick = allPicksForPlayer[allPicksForPlayer.length - 1];
    if (!finalPick?.rosterId || finalPick.rosterId === pick.rosterId) continue;

    // Check if there's actually a keeper record on the wrong roster
    const wrongKeeper = await prisma.keeper.findFirst({
      where: {
        playerId: pick.playerId,
        rosterId: pick.rosterId,
        season: pick.draft.season,
      },
    });

    mismatches.push({
      player: pick.player?.fullName || "Unknown",
      season: pick.draft.season,
      keeperPickRoster: pick.roster.teamName || "Unknown",
      finalPickRoster: finalPick.roster?.teamName || "Unknown",
      hasWrongKeeper: !!wrongKeeper,
    });
  }

  console.log(`Found ${mismatches.length} potential mismatches:\n`);

  for (const m of mismatches) {
    const status = m.hasWrongKeeper ? "❌ NEEDS FIX" : "✓ Already correct";
    console.log(`${m.player} (${m.season}):`);
    console.log(`  Keeper pick roster: ${m.keeperPickRoster}`);
    console.log(`  Final pick roster: ${m.finalPickRoster}`);
    console.log(`  Status: ${status}\n`);
  }

  const needsFix = mismatches.filter((m) => m.hasWrongKeeper);
  console.log(`\nTotal needing fix: ${needsFix.length}`);

  await prisma.$disconnect();
}

// Main
const args = process.argv.slice(2);
if (args.includes("--dry-run")) {
  dryRunCheck().catch(console.error);
} else {
  fixKeeperRosterAssignments().catch(console.error);
}
