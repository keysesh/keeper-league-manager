import { PrismaClient } from "@prisma/client";
import { populateKeepersFromDraftPicks, recalculateKeeperYears } from "../src/lib/sleeper/sync";
import { recalculateAndApplyCascade } from "../src/lib/keeper/cascade";

const prisma = new PrismaClient();

async function finalizeKeepers() {
  console.log("=== FINALIZING KEEPERS ===\n");

  // Get all E Pluribus leagues (oldest first for proper yearsKept calculation)
  const leagues = await prisma.league.findMany({
    where: { name: { contains: "E Pluribus" } },
    orderBy: { season: "asc" },
  });

  console.log(`Found ${leagues.length} leagues\n`);

  // Step 1: Populate keepers from draft picks (oldest first)
  console.log("=== STEP 1: Populating keepers from draft picks ===");
  for (const league of leagues) {
    console.log(`\n${league.name} (${league.season}):`);
    const result = await populateKeepersFromDraftPicks(league.id);
    console.log(`  Created: ${result.created}, Skipped: ${result.skipped}`);
  }

  // Step 2: Recalculate keeper years
  console.log("\n\n=== STEP 2: Recalculating keeper years ===");
  for (const league of leagues) {
    console.log(`\n${league.name} (${league.season}):`);
    const result = await recalculateKeeperYears(league.id);
    console.log(`  Updated: ${result.updated} of ${result.total}`);
  }

  // Step 3: Apply cascade for 2026 (planning season)
  console.log("\n\n=== STEP 3: Applying cascade for 2026 ===");
  const mainLeague = leagues.find((l) => l.season === 2025); // Current league is 2025 season
  if (mainLeague) {
    try {
      const result = await recalculateAndApplyCascade(mainLeague.id, 2026);
      console.log(`Updated ${result.updatedCount} final costs`);
      if (result.errors.length > 0) {
        console.log(`Errors: ${result.errors.join(", ")}`);
      }
    } catch (err) {
      console.log(`Error: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Final state
  console.log("\n\n=== FINAL STATE ===");
  const keepers = await prisma.keeper.findMany({
    include: {
      player: { select: { fullName: true } },
      roster: { select: { teamName: true, leagueId: true } },
    },
    orderBy: [{ season: "desc" }, { roster: { teamName: "asc" } }, { finalCost: "asc" }],
  });

  // Group by season and team
  const bySeasonTeam: Record<number, Record<string, Array<{
    name: string;
    base: number;
    final: number;
    years: number;
    type: string;
  }>>> = {};

  for (const k of keepers) {
    if (!bySeasonTeam[k.season]) bySeasonTeam[k.season] = {};
    const team = k.roster.teamName || "Unknown";
    if (!bySeasonTeam[k.season][team]) bySeasonTeam[k.season][team] = [];
    bySeasonTeam[k.season][team].push({
      name: k.player.fullName,
      base: k.baseCost,
      final: k.finalCost,
      years: k.yearsKept,
      type: k.type,
    });
  }

  for (const [season, teams] of Object.entries(bySeasonTeam).sort((a, b) => Number(b[0]) - Number(a[0]))) {
    console.log(`\n========== Season ${season} ==========`);
    for (const [team, players] of Object.entries(teams)) {
      console.log(`\n  ${team}: ${players.length} keepers`);
      for (const p of players.sort((a, b) => a.final - b.final)) {
        const ft = p.type === "FRANCHISE" ? " [FT]" : "";
        console.log(`    R${p.final}: ${p.name} (base R${p.base}, Y${p.years})${ft}`);
      }
    }
  }

  console.log("\n\n=== SUMMARY ===");
  const totals = await prisma.keeper.groupBy({
    by: ["season"],
    _count: { id: true },
    orderBy: { season: "desc" },
  });
  for (const t of totals) {
    console.log(`Season ${t.season}: ${t._count.id} keepers`);
  }

  await prisma.$disconnect();
}

finalizeKeepers().catch(console.error);
