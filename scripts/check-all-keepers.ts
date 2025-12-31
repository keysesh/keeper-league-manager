import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  // Get all keepers
  const keepers = await prisma.keeper.findMany({
    include: {
      player: true,
      roster: { include: { teamMembers: { include: { user: true } } } },
    },
    orderBy: [{ season: "desc" }, { roster: { sleeperId: "asc" } }],
  });

  console.log("=== ALL KEEPERS IN DB ===");
  console.log("Total:", keepers.length);
  console.log("");

  const bySeason = new Map<number, typeof keepers>();
  for (const k of keepers) {
    if (!bySeason.has(k.season)) {
      bySeason.set(k.season, []);
    }
    bySeason.get(k.season)!.push(k);
  }

  for (const [season, seasonKeepers] of bySeason) {
    console.log(`--- Season ${season} (${seasonKeepers.length} keepers) ---`);
    for (const k of seasonKeepers) {
      const owner =
        k.roster?.teamMembers?.[0]?.user?.displayName ||
        k.roster?.sleeperId ||
        "Unknown";
      console.log(
        `  ${k.player?.fullName} (${owner}): baseCost=R${k.baseCost}, yearsKept=${k.yearsKept}, finalCost=R${k.finalCost}`
      );
    }
    console.log("");
  }

  await prisma.$disconnect();
}

check();
