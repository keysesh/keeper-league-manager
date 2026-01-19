import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Get all rosters for this league
  const rosters = await prisma.roster.findMany({
    where: { league: { name: { contains: '' } } },
    select: { id: true, teamName: true, sleeperId: true },
    take: 20
  });
  
  console.log('Rosters in DB:');
  for (const r of rosters) {
    console.log(`  ${r.teamName}: sleeperId = "${r.sleeperId}"`);
  }
  
  console.log('\nThe trade metadata has roster_ids: [1, 8]');
  console.log('But our DB rosters have sleeperId like "864935658458877952" (owner_id)');
  console.log('The API tries to match String(1) === "864935658458877952" which NEVER matches!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
