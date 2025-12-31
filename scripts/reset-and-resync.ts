import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function resetAndResync() {
  console.log("=== RESETTING DATABASE ===\n");

  // Get the main league first
  const league = await prisma.league.findFirst({
    where: { sleeperId: "1256780766516359168" },
  });

  if (!league) {
    console.log("League not found - nothing to reset");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found league: ${league.name} (${league.id})`);

  // Delete in order (respecting foreign keys)
  console.log("\n1. Deleting keepers...");
  const keepersDeleted = await prisma.keeper.deleteMany({
    where: { roster: { leagueId: league.id } },
  });
  console.log(`   Deleted ${keepersDeleted.count} keepers`);

  console.log("\n2. Deleting transaction players...");
  const txPlayersDeleted = await prisma.transactionPlayer.deleteMany({
    where: { transaction: { leagueId: league.id } },
  });
  console.log(`   Deleted ${txPlayersDeleted.count} transaction players`);

  console.log("\n3. Deleting transactions...");
  const txDeleted = await prisma.transaction.deleteMany({
    where: { leagueId: league.id },
  });
  console.log(`   Deleted ${txDeleted.count} transactions`);

  console.log("\n4. Deleting draft picks...");
  const picksDeleted = await prisma.draftPick.deleteMany({
    where: { draft: { leagueId: league.id } },
  });
  console.log(`   Deleted ${picksDeleted.count} draft picks`);

  console.log("\n5. Deleting drafts...");
  const draftsDeleted = await prisma.draft.deleteMany({
    where: { leagueId: league.id },
  });
  console.log(`   Deleted ${draftsDeleted.count} drafts`);

  console.log("\n6. Deleting traded picks...");
  const tradedDeleted = await prisma.tradedPick.deleteMany({
    where: { leagueId: league.id },
  });
  console.log(`   Deleted ${tradedDeleted.count} traded picks`);

  console.log("\n7. Deleting roster players...");
  const rosterPlayersDeleted = await prisma.rosterPlayer.deleteMany({
    where: { roster: { leagueId: league.id } },
  });
  console.log(`   Deleted ${rosterPlayersDeleted.count} roster players`);

  console.log("\n=== DATABASE CLEARED ===");
  console.log("\nKept: League, Rosters, Team Members, Users, Players, Keeper Settings");

  await prisma.$disconnect();
}

resetAndResync().catch(console.error);
