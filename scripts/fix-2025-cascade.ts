import { PrismaClient } from "@prisma/client";
import { calculateCascade } from "../src/lib/keeper/cascade";

const prisma = new PrismaClient();

async function fix() {
  const league = await prisma.league.findFirst({
    where: { sleeperId: "1256780766516359168" },
  });

  if (!league) {
    console.log("League not found");
    return;
  }

  const keepers = await prisma.keeper.findMany({
    where: { season: 2025, roster: { leagueId: league.id } },
    include: { player: true, roster: true },
  });

  console.log("=== RECALCULATING 2025 CASCADE ===");
  console.log("Keepers:", keepers.length);

  const inputs = keepers.map((k) => ({
    playerId: k.playerId,
    rosterId: k.rosterId,
    playerName: k.player.fullName,
    type: k.type as "FRANCHISE" | "REGULAR",
  }));

  const result = await calculateCascade(league.id, inputs, 2025);

  console.log("\nCascade results:");
  for (const r of result.keepers) {
    const keeper = keepers.find((k) => k.playerId === r.playerId);
    const cascadeNote = r.isCascaded ? " (cascaded)" : "";
    console.log(
      `${r.playerName} (${keeper?.roster.teamName}): R${r.baseCost} -> R${r.finalCost}${cascadeNote}`
    );
    if (r.conflictsWith.length) {
      console.log(`  Conflicts: ${r.conflictsWith.join(", ")}`);
    }
  }

  if (result.errors.length) {
    console.log("\nErrors:", result.errors);
  }

  // Apply updates
  console.log("\n=== APPLYING UPDATES ===");
  let updated = 0;
  for (const r of result.keepers) {
    const keeper = keepers.find(
      (k) => k.playerId === r.playerId && k.rosterId === r.rosterId
    );
    if (keeper) {
      const needsUpdate =
        keeper.baseCost !== r.baseCost || keeper.finalCost !== r.finalCost;
      if (needsUpdate) {
        await prisma.keeper.update({
          where: { id: keeper.id },
          data: {
            baseCost: r.baseCost,
            finalCost: r.finalCost,
          },
        });
        updated++;
      }
    }
  }
  console.log(`Updated ${updated} keepers`);

  // Verify
  console.log("\n=== VERIFICATION ===");
  const updatedKeepers = await prisma.keeper.findMany({
    where: { season: 2025, roster: { leagueId: league.id } },
    include: { player: true, roster: true },
    orderBy: [{ roster: { teamName: "asc" } }, { finalCost: "asc" }],
  });

  let currentTeam = "";
  for (const k of updatedKeepers) {
    if (k.roster.teamName !== currentTeam) {
      currentTeam = k.roster.teamName || "";
      console.log(`\n${currentTeam}:`);
    }
    console.log(`  R${k.finalCost}: ${k.player.fullName} (base: R${k.baseCost})`);
  }

  await prisma.$disconnect();
}

fix().catch(console.error);
