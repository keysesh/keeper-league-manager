import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fixes based on verification against Sleeper API
const fixes = [
  // 2025 keepers
  { playerName: "Hunter Henry", season: 2025, baseCost: 8, yearsKept: 1, finalCost: 8 },
  { playerName: "Quinshon Judkins", season: 2025, baseCost: 7, yearsKept: 1, finalCost: 7 },
  { playerName: "Travis Etienne", season: 2025, baseCost: 7, yearsKept: 1, finalCost: 7 },
  { playerName: "Chase Brown", season: 2025, baseCost: 8, yearsKept: 1, finalCost: 8 },
  { playerName: "Aaron Jones", season: 2025, baseCost: 1, yearsKept: 3, finalCost: 1 },
  { playerName: "Khalil Shakir", season: 2025, baseCost: 10, yearsKept: 2, finalCost: 9 },
  { playerName: "Trey Benson", season: 2025, baseCost: 10, yearsKept: 1, finalCost: 10 },
  { playerName: "Tyrone Tracy", season: 2025, baseCost: 11, yearsKept: 2, finalCost: 10 },
  { playerName: "Calvin Ridley", season: 2025, baseCost: 16, yearsKept: 2, finalCost: 15 },
  { playerName: "George Pickens", season: 2025, baseCost: 6, yearsKept: 2, finalCost: 5 },
  { playerName: "Javonte Williams", season: 2025, baseCost: 4, yearsKept: 1, finalCost: 4 },
  { playerName: "Lamar Jackson", season: 2025, baseCost: 2, yearsKept: 3, finalCost: 1 },
];

async function main() {
  console.log("=== FIXING KEEPER RECORDS ===\n");

  for (const fix of fixes) {
    const result = await prisma.keeper.updateMany({
      where: {
        player: { fullName: fix.playerName },
        season: fix.season,
      },
      data: {
        baseCost: fix.baseCost,
        yearsKept: fix.yearsKept,
        finalCost: fix.finalCost,
      },
    });

    if (result.count > 0) {
      console.log(
        `✓ ${fix.playerName} (${fix.season}): baseCost=R${fix.baseCost}, yearsKept=${fix.yearsKept}, finalCost=R${fix.finalCost}`
      );
    } else {
      console.log(`✗ ${fix.playerName} (${fix.season}): Not found`);
    }
  }

  console.log("\n=== VERIFICATION ===\n");

  const keepers = await prisma.keeper.findMany({
    where: { season: 2025 },
    include: { player: true },
    orderBy: { player: { fullName: "asc" } },
  });

  for (const k of keepers) {
    console.log(
      `${k.player?.fullName}: baseCost=R${k.baseCost}, yearsKept=${k.yearsKept}, finalCost=R${k.finalCost}`
    );
  }

  await prisma.$disconnect();
}

main();
