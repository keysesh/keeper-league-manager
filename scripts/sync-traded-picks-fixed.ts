import { PrismaClient } from "@prisma/client";
import { SleeperClient } from "../src/lib/sleeper/client";
import { recalculateAndApplyCascade } from "../src/lib/keeper/cascade";

const prisma = new PrismaClient();
const sleeper = new SleeperClient();

async function syncTradedPicksAndCascade() {
  console.log("=== SYNCING TRADED PICKS AND APPLYING CASCADE ===\n");

  // Get all leagues
  const leagues = await prisma.league.findMany({
    where: { name: { contains: "E Pluribus" } },
    orderBy: { season: "desc" },
  });

  for (const league of leagues) {
    console.log(`\n=== ${league.name} (${league.season}) ===`);

    // Get rosters to build owner mapping
    const sleeperRosters = await sleeper.getRosters(league.sleeperId);
    const slotToOwner = new Map<number, string>();
    for (const r of sleeperRosters) {
      if (r.owner_id) {
        slotToOwner.set(r.roster_id, r.owner_id);
      }
    }

    // Get traded picks from Sleeper
    const tradedPicks = await sleeper.getTradedPicks(league.sleeperId);
    console.log(`Found ${tradedPicks.length} traded picks from Sleeper`);

    // Clear existing traded picks for this league
    await prisma.tradedPick.deleteMany({ where: { leagueId: league.id } });

    // Sync traded picks with proper owner_id mapping
    let synced = 0;
    for (const pick of tradedPicks) {
      // Per Sleeper API: roster_id = ORIGINAL owner, owner_id = CURRENT owner
      const originalOwnerId = slotToOwner.get(pick.roster_id);
      const currentOwnerId = slotToOwner.get(pick.owner_id);

      if (!originalOwnerId || !currentOwnerId) {
        console.log(`  Skipping: slot ${pick.owner_id} -> ${pick.roster_id} (no owner mapping)`);
        continue;
      }

      try {
        await prisma.tradedPick.create({
          data: {
            leagueId: league.id,
            season: parseInt(pick.season),
            round: pick.round,
            originalOwnerId,
            currentOwnerId,
          },
        });
        synced++;
      } catch {
        // Duplicate - ignore
      }
    }
    console.log(`Synced ${synced} traded picks`);
  }

  // Apply cascade for 2025 and 2026
  console.log("\n\n=== APPLYING CASCADE ===");
  const mainLeague = await prisma.league.findFirst({
    where: { sleeperId: "1256780766516359168" },
  });

  if (mainLeague) {
    for (const season of [2025, 2026]) {
      console.log(`\nSeason ${season}:`);
      try {
        const result = await recalculateAndApplyCascade(mainLeague.id, season);
        console.log(`  Updated ${result.updatedCount} final costs`);
        if (result.errors.length > 0) {
          console.log(`  Errors: ${result.errors.join(", ")}`);
        }
      } catch (err) {
        console.log(`  Error: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  // Show final 2025 keepers
  console.log("\n\n=== FINAL 2025 KEEPERS ===");
  const keepers2025 = await prisma.keeper.findMany({
    where: { season: 2025, roster: { leagueId: mainLeague?.id } },
    include: {
      player: { select: { fullName: true } },
      roster: { select: { teamName: true } },
    },
    orderBy: [{ roster: { teamName: "asc" } }, { finalCost: "asc" }],
  });

  let currentTeam = "";
  for (const k of keepers2025) {
    if (k.roster.teamName !== currentTeam) {
      currentTeam = k.roster.teamName || "";
      console.log(`\n${currentTeam}:`);
    }
    const ft = k.type === "FRANCHISE" ? " [FT]" : "";
    console.log(`  R${k.finalCost}: ${k.player.fullName} (base R${k.baseCost}, Y${k.yearsKept})${ft}`);
  }

  await prisma.$disconnect();
}

syncTradedPicksAndCascade().catch(console.error);
