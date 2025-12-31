import { PrismaClient } from "@prisma/client";
import { syncLeagueWithHistory, populateKeepersFromDraftPicks, recalculateKeeperYears } from "../src/lib/sleeper/sync";
import { recalculateAndApplyCascade } from "../src/lib/keeper/cascade";

const prisma = new PrismaClient();

async function fullResync() {
  console.log("=== FULL RE-SYNC FROM SLEEPER ===\n");

  // Get the main league
  const league = await prisma.league.findFirst({
    where: { sleeperId: "1256780766516359168" },
  });

  if (!league) {
    console.log("League not found!");
    await prisma.$disconnect();
    return;
  }

  console.log(`Syncing: ${league.name}`);
  console.log(`Sleeper ID: ${league.sleeperId}\n`);

  // Step 1: Sync league with full history (drafts, transactions, traded picks)
  console.log("=== STEP 1: Syncing league with history ===");
  try {
    const historyResult = await syncLeagueWithHistory(league.sleeperId, 10);
    console.log(`Synced ${historyResult.seasons.length} seasons:`);
    for (const s of historyResult.seasons) {
      console.log(`  - ${s.season}: ${s.name}`);
    }
    console.log(`Total transactions: ${historyResult.totalTransactions}`);
  } catch (err) {
    console.error("Error syncing history:", err);
  }

  // Step 2: Get all league IDs in the chain for keeper population
  console.log("\n=== STEP 2: Populating keepers from draft picks ===");
  const allLeagues = await prisma.league.findMany({
    where: {
      OR: [
        { id: league.id },
        { sleeperId: league.previousLeagueId || "none" },
      ],
    },
    orderBy: { season: "asc" },
  });

  // Build the full chain
  const leagueChain: string[] = [];
  let currentLeagueId: string | null = league.id;
  const visited = new Set<string>();

  while (currentLeagueId && !visited.has(currentLeagueId)) {
    visited.add(currentLeagueId);
    leagueChain.push(currentLeagueId);

    const currentLeague: { previousLeagueId: string | null } | null = await prisma.league.findUnique({
      where: { id: currentLeagueId },
      select: { previousLeagueId: true },
    });

    if (currentLeague?.previousLeagueId) {
      const prevLeague: { id: string } | null = await prisma.league.findUnique({
        where: { sleeperId: currentLeague.previousLeagueId },
        select: { id: true },
      });
      currentLeagueId = prevLeague?.id || null;
    } else {
      currentLeagueId = null;
    }
  }

  console.log(`Found ${leagueChain.length} leagues in chain`);

  // Populate keepers for each league (oldest first)
  let totalCreated = 0;
  for (const leagueId of leagueChain.reverse()) {
    const result = await populateKeepersFromDraftPicks(leagueId);
    console.log(`  League ${leagueId}: created ${result.created}, skipped ${result.skipped}`);
    totalCreated += result.created;
  }
  console.log(`Total keepers created: ${totalCreated}`);

  // Step 3: Recalculate keeper years
  console.log("\n=== STEP 3: Recalculating keeper years ===");
  for (const leagueId of leagueChain) {
    const result = await recalculateKeeperYears(leagueId);
    console.log(`  League ${leagueId}: updated ${result.updated} of ${result.total}`);
  }

  // Step 4: Apply cascade for current planning season
  console.log("\n=== STEP 4: Applying cascade ===");
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const planningSeason = month >= 8 ? year + 1 : month < 2 ? year : year;

  for (const leagueId of leagueChain) {
    // Get the league's season
    const leagueData = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { season: true },
    });

    if (leagueData) {
      // Apply cascade for both the league's season and planning season
      const seasons = new Set([leagueData.season, planningSeason]);
      for (const season of seasons) {
        try {
          const result = await recalculateAndApplyCascade(leagueId, season);
          if (result.updatedCount > 0) {
            console.log(`  League ${leagueId}, Season ${season}: updated ${result.updatedCount} final costs`);
          }
          if (result.errors.length > 0) {
            console.log(`    Errors: ${result.errors.join(", ")}`);
          }
        } catch (err) {
          // Ignore errors for seasons with no keepers
        }
      }
    }
  }

  // Final verification
  console.log("\n=== FINAL STATE ===");
  const keepers = await prisma.keeper.findMany({
    where: { roster: { leagueId: league.id } },
    include: {
      player: { select: { fullName: true } },
      roster: { select: { teamName: true } },
    },
    orderBy: [{ season: "desc" }, { finalCost: "asc" }],
  });

  const bySeasonTeam: Record<number, Record<string, Array<{ name: string; cost: number; base: number; type: string }>>> = {};
  for (const k of keepers) {
    if (!bySeasonTeam[k.season]) bySeasonTeam[k.season] = {};
    const team = k.roster.teamName || "Unknown";
    if (!bySeasonTeam[k.season][team]) bySeasonTeam[k.season][team] = [];
    bySeasonTeam[k.season][team].push({
      name: k.player.fullName,
      cost: k.finalCost,
      base: k.baseCost,
      type: k.type,
    });
  }

  for (const [season, teams] of Object.entries(bySeasonTeam).sort((a, b) => Number(b[0]) - Number(a[0]))) {
    console.log(`\n--- Season ${season} ---`);
    for (const [team, players] of Object.entries(teams)) {
      console.log(`  ${team}: ${players.length} keepers`);
      for (const p of players.sort((a, b) => a.cost - b.cost)) {
        const ft = p.type === "FRANCHISE" ? " [FT]" : "";
        console.log(`    R${p.cost}: ${p.name} (base R${p.base})${ft}`);
      }
    }
  }

  // Count totals
  const tradedPicks = await prisma.tradedPick.count({ where: { leagueId: league.id } });
  const draftPicks = await prisma.draftPick.count({ where: { draft: { leagueId: league.id } } });
  const transactions = await prisma.transaction.count({ where: { leagueId: league.id } });

  console.log("\n=== SYNC SUMMARY ===");
  console.log(`Draft picks: ${draftPicks}`);
  console.log(`Transactions: ${transactions}`);
  console.log(`Traded picks: ${tradedPicks}`);
  console.log(`Keepers: ${keepers.length}`);

  await prisma.$disconnect();
}

fullResync().catch(console.error);
