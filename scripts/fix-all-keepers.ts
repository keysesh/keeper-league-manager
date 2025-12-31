import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fixes based on Sleeper API history - using ORIGINAL draft & current owner tenure
// baseCost = earliest draft round (or R8 if undrafted)
// yearsKept = consecutive years on CURRENT owner's roster
// finalCost = max(1, baseCost - (yearsKept - 1))
const fixes = [
  // 2025 keepers - analyzed from Sleeper history
  // Hunter Henry: 2024 owner ≠ 2025 owner → year 1, undrafted (R8)
  { playerName: "Hunter Henry", season: 2025, baseCost: 8, yearsKept: 1, finalCost: 8 },
  // Quinshon Judkins: Only 2025 data, drafted R7 → year 1
  { playerName: "Quinshon Judkins", season: 2025, baseCost: 7, yearsKept: 1, finalCost: 7 },
  // Travis Etienne: 2023/2024 owner ≠ 2025 owner → year 1, original R7
  { playerName: "Travis Etienne", season: 2025, baseCost: 7, yearsKept: 1, finalCost: 7 },
  // Chase Brown: 2024 owner ≠ 2025 owner → year 1, original R8
  { playerName: "Chase Brown", season: 2025, baseCost: 8, yearsKept: 1, finalCost: 8 },
  // Aaron Jones: Same owner 2023-2025 → year 3, original R1
  { playerName: "Aaron Jones", season: 2025, baseCost: 1, yearsKept: 3, finalCost: 1 },
  // Khalil Shakir: 2024 owner ≠ 2025 owner → year 1, original R10
  { playerName: "Khalil Shakir", season: 2025, baseCost: 10, yearsKept: 1, finalCost: 10 },
  // Trey Benson: 2024 owner ≠ 2025 owner → year 1, original R10
  { playerName: "Trey Benson", season: 2025, baseCost: 10, yearsKept: 1, finalCost: 10 },
  // Tyrone Tracy: 2024 owner ≠ 2025 owner → year 1, undrafted in 2024 (R8)
  { playerName: "Tyrone Tracy", season: 2025, baseCost: 8, yearsKept: 1, finalCost: 8 },
  // Calvin Ridley: Same owner 2024-2025 → year 2, original R16 in 2023
  { playerName: "Calvin Ridley", season: 2025, baseCost: 16, yearsKept: 2, finalCost: 15 },
  // George Pickens: Same owner 2024-2025 → year 2, original R6 in 2023
  { playerName: "George Pickens", season: 2025, baseCost: 6, yearsKept: 2, finalCost: 5 },
  // Javonte Williams: All 3 years different owners → year 1, original R4
  { playerName: "Javonte Williams", season: 2025, baseCost: 4, yearsKept: 1, finalCost: 4 },
  // Lamar Jackson: Same owner 2023-2025 → year 3, original R2
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
