import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function deleteLeague() {
  const leagueName = "Incompetent at Fantasy Football";

  console.log(`Looking for league: "${leagueName}"...`);

  const league = await prisma.league.findFirst({
    where: {
      name: {
        contains: "incompetent",
        mode: "insensitive"
      }
    },
    select: {
      id: true,
      name: true,
      season: true,
      _count: {
        select: {
          rosters: true,
          drafts: true,
          transactions: true
        }
      }
    }
  });

  if (!league) {
    console.log("No matching league found.");

    // List all leagues
    const allLeagues = await prisma.league.findMany({
      select: { id: true, name: true, season: true }
    });
    console.log("\nExisting leagues:");
    allLeagues.forEach(l => console.log(`  - ${l.name} (${l.season})`));
    return;
  }

  console.log(`\nFound league:`);
  console.log(`  Name: ${league.name}`);
  console.log(`  Season: ${league.season}`);
  console.log(`  Rosters: ${league._count.rosters}`);
  console.log(`  Drafts: ${league._count.drafts}`);
  console.log(`  Transactions: ${league._count.transactions}`);

  console.log(`\nDeleting league "${league.name}"...`);

  await prisma.league.delete({
    where: { id: league.id }
  });

  console.log("League deleted successfully!");

  // Show remaining leagues
  const remaining = await prisma.league.findMany({
    select: { name: true, season: true }
  });
  console.log("\nRemaining leagues:");
  remaining.forEach(l => console.log(`  - ${l.name} (${l.season})`));
}

deleteLeague()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
