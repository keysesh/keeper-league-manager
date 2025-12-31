import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanup() {
  // Get all leagues with their roster sleeper IDs
  const leagues = await prisma.league.findMany({
    include: {
      rosters: { select: { sleeperId: true } }
    }
  });

  // Build a set of all valid sleeper IDs
  const validIds = new Set<string>();
  for (const league of leagues) {
    for (const roster of league.rosters) {
      if (roster.sleeperId) {
        validIds.add(roster.sleeperId);
      }
    }
  }

  console.log("Valid Sleeper IDs:", validIds.size);
  console.log("IDs:", [...validIds].join(", "));

  // Delete traded picks where IDs don't match any roster
  const allPicks = await prisma.tradedPick.findMany();
  let deleted = 0;

  for (const pick of allPicks) {
    const hasValidOriginal = validIds.has(pick.originalOwnerId);
    const hasValidCurrent = validIds.has(pick.currentOwnerId);

    if (!hasValidOriginal || !hasValidCurrent) {
      await prisma.tradedPick.delete({ where: { id: pick.id } });
      deleted++;
    }
  }

  console.log("Deleted", deleted, "entries with invalid IDs");
  console.log("Remaining:", await prisma.tradedPick.count());

  await prisma.$disconnect();
}

cleanup();
