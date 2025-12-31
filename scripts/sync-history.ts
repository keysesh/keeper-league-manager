import { syncLeagueWithHistory, populateKeepersFromDraftPicks } from '../src/lib/sleeper/sync';
import { prisma } from '../src/lib/prisma';

async function main() {
  const leagues = [
    { name: 'E Pluribus Gridiron Dynasty', sleeperId: '1256780766516359168' },
    { name: 'Incomptent at Fantasy Football', sleeperId: '1257420898252623872' },
  ];

  for (const league of leagues) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Syncing: ${league.name}`);
    console.log('='.repeat(50));

    try {
      // Step 1: Sync league with history (gets all historical seasons)
      console.log('\n1. Syncing historical seasons...');
      const syncResult = await syncLeagueWithHistory(league.sleeperId);
      console.log(`   Synced ${syncResult.seasons.length} season(s):`);
      for (const s of syncResult.seasons) {
        console.log(`   - ${s.season}: ${s.name}`);
      }
      console.log(`   Total transactions: ${syncResult.totalTransactions}`);

      // Step 2: Populate keepers from draft picks for each synced league
      console.log('\n2. Populating keepers from draft picks...');
      for (const season of syncResult.seasons) {
        const populateResult = await populateKeepersFromDraftPicks(season.leagueId);
        console.log(`   ${season.season}: Created ${populateResult.created}, skipped ${populateResult.skipped}`);
      }

      console.log('\n✓ Complete!');
    } catch (err) {
      console.error(`Error syncing ${league.name}:`, err);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
