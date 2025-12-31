import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  // Find Chris Godwin
  const player = await prisma.player.findFirst({
    where: { fullName: { contains: "Godwin", mode: "insensitive" } },
  });

  if (!player) {
    console.log("Player not found");
    return;
  }

  console.log("Player:", player.fullName, "- ID:", player.id);

  // Check keeper records
  const keepers = await prisma.keeper.findMany({
    where: { playerId: player.id },
    include: { roster: true },
  });

  console.log("\nKeeper Records:");
  keepers.forEach((k) => {
    console.log(
      `  Season ${k.season}: baseCost=R${k.baseCost}, yearsKept=${k.yearsKept}, finalCost=R${k.finalCost}, type=${k.type}`
    );
  });

  // Check draft history
  const picks = await prisma.draftPick.findMany({
    where: { playerId: player.id },
    include: { draft: true },
    orderBy: { draft: { season: "asc" } },
  });

  console.log("\nDraft History:");
  picks.forEach((p) => {
    console.log(
      `  Season ${p.draft.season}: Round ${p.round}, Pick ${p.pickNumber}`
    );
  });

  await prisma.$disconnect();
}

check();
