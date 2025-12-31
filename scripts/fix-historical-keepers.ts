import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixHistoricalKeepers() {
  console.log("=== FIXING HISTORICAL KEEPERS ===\n");

  // For historical seasons (2023, 2024, 2025), the finalCost should match the round they were drafted at
  // The cascade algorithm is for FUTURE planning, not historical data

  const historicalSeasons = [2023, 2024, 2025];

  for (const season of historicalSeasons) {
    console.log(`\n--- Season ${season} ---`);

    // Get keepers with their draft picks
    const keepers = await prisma.keeper.findMany({
      where: { season },
      include: {
        player: { select: { id: true, fullName: true, sleeperId: true } },
        roster: { select: { id: true, teamName: true, leagueId: true } },
      },
    });

    console.log(`Found ${keepers.length} keepers`);

    let updated = 0;
    for (const keeper of keepers) {
      // Find the draft pick for this player in this season
      const draftPick = await prisma.draftPick.findFirst({
        where: {
          playerId: keeper.playerId,
          rosterId: keeper.rosterId,
          isKeeper: true,
          draft: { season },
        },
        include: { draft: true },
      });

      if (draftPick) {
        // Set finalCost to the actual draft round
        if (keeper.finalCost !== draftPick.round) {
          await prisma.keeper.update({
            where: { id: keeper.id },
            data: { finalCost: draftPick.round },
          });
          console.log(`  ${keeper.player.fullName}: R${keeper.finalCost} -> R${draftPick.round}`);
          updated++;
        }
      }
    }

    console.log(`Updated ${updated} keepers`);
  }

  // Show final state
  console.log("\n\n=== FINAL STATE ===");
  const allKeepers = await prisma.keeper.findMany({
    include: {
      player: { select: { fullName: true } },
      roster: { select: { teamName: true } },
    },
    orderBy: [{ season: "desc" }, { roster: { teamName: "asc" } }, { finalCost: "asc" }],
  });

  let currentSeason = 0;
  let currentTeam = "";
  for (const k of allKeepers) {
    if (k.season !== currentSeason) {
      currentSeason = k.season;
      currentTeam = "";
      console.log(`\n========== Season ${k.season} ==========`);
    }
    if (k.roster.teamName !== currentTeam) {
      currentTeam = k.roster.teamName || "";
      console.log(`\n  ${currentTeam}:`);
    }
    const ft = k.type === "FRANCHISE" ? " [FT]" : "";
    console.log(`    R${k.finalCost}: ${k.player.fullName} (base R${k.baseCost}, Y${k.yearsKept})${ft}`);
  }

  await prisma.$disconnect();
}

fixHistoricalKeepers().catch(console.error);
