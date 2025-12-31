import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== CHECKING LEAGUE HISTORY ===\n');

  // Get all leagues
  const leagues = await prisma.league.findMany({
    select: {
      id: true,
      sleeperId: true,
      name: true,
      season: true,
      previousLeagueId: true
    }
  });

  console.log('Leagues in database:');
  for (const league of leagues) {
    console.log(`\n${league.name} (${league.season})`);
    console.log(`  ID: ${league.id}`);
    console.log(`  Sleeper ID: ${league.sleeperId}`);
    console.log(`  Previous League ID: ${league.previousLeagueId || 'None'}`);

    // Count drafts for this league
    const draftCount = await prisma.draft.count({
      where: { leagueId: league.id }
    });
    console.log(`  Drafts synced: ${draftCount}`);

    // Get draft seasons
    const drafts = await prisma.draft.findMany({
      where: { leagueId: league.id },
      select: { season: true },
      orderBy: { season: 'asc' }
    });
    if (drafts.length > 0) {
      console.log(`  Draft seasons: ${drafts.map(d => d.season).join(', ')}`);
    }
  }

  // Check Sleeper API for league history chain
  console.log('\n\n=== CHECKING SLEEPER API FOR HISTORY ===\n');

  for (const league of leagues) {
    console.log(`Fetching history for ${league.sleeperId}...`);

    try {
      const response = await fetch(`https://api.sleeper.app/v1/league/${league.sleeperId}`);
      const data = await response.json();

      console.log(`  Current Season: ${data.season}`);
      console.log(`  Previous League ID: ${data.previous_league_id || 'None'}`);

      // Follow the chain back
      let prevId = data.previous_league_id;
      let depth = 1;

      while (prevId && depth < 10) {
        const prevResponse = await fetch(`https://api.sleeper.app/v1/league/${prevId}`);
        const prevData = await prevResponse.json();
        console.log(`  └─ ${prevData.season}: ${prevId}`);
        prevId = prevData.previous_league_id;
        depth++;
      }
    } catch (e) {
      console.log(`  Error: ${e}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
