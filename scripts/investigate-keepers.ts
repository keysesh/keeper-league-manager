import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function investigatePlayer(name: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`INVESTIGATING: ${name}`);
  console.log('='.repeat(60));

  const player = await prisma.player.findFirst({
    where: { fullName: { contains: name, mode: 'insensitive' } }
  });

  if (!player) {
    console.log('Player not found!');
    return;
  }

  console.log(`\nPlayer ID: ${player.id}`);
  console.log(`Sleeper ID: ${player.sleeperId}`);

  // Get ALL draft picks
  const drafts = await prisma.draftPick.findMany({
    where: { playerId: player.id },
    include: {
      draft: { select: { season: true, leagueId: true, type: true } },
      roster: { select: { teamName: true, sleeperId: true } }
    },
    orderBy: { draft: { season: 'asc' } }
  });

  console.log(`\nDraft Picks (${drafts.length} total):`);
  drafts.forEach(d => {
    const keeperFlag = d.isKeeper ? ' [KEEPER SLOT]' : ' [ORIGINAL]';
    console.log(`  ${d.draft.season}: R${d.round}, Pick #${d.pickNumber}${keeperFlag}`);
    console.log(`    Team: ${d.roster?.teamName}`);
    console.log(`    Draft Type: ${d.draft.type}`);
  });

  // Get ALL keeper records
  const keepers = await prisma.keeper.findMany({
    where: { playerId: player.id },
    include: { roster: { select: { teamName: true } } },
    orderBy: { season: 'asc' }
  });

  console.log(`\nKeeper Records (${keepers.length} total):`);
  keepers.forEach(k => {
    const typeEmoji = k.type === 'FRANCHISE' ? '🏷️ FT' : '📌 REG';
    console.log(`  ${k.season}: ${typeEmoji}`);
    console.log(`    Base: R${k.baseCost} → Final: R${k.finalCost}`);
    console.log(`    Years Kept: ${k.yearsKept}`);
    console.log(`    Acquisition: ${k.acquisitionType}`);
    console.log(`    Team: ${k.roster.teamName}`);
  });

  // Get ALL transactions
  const txs = await prisma.transactionPlayer.findMany({
    where: { playerId: player.id },
    include: { transaction: true },
    orderBy: { transaction: { createdAt: 'asc' } }
  });

  console.log(`\nTransactions (${txs.length} total):`);
  txs.forEach(t => {
    const date = t.transaction.createdAt.toISOString().split('T')[0];
    console.log(`  ${date}: ${t.transaction.type} (Week ${t.transaction.week})`);
    console.log(`    From: ${t.fromRosterId || 'N/A'} → To: ${t.toRosterId || 'N/A'}`);
  });

  // Find the ORIGINAL draft (not keeper slot)
  const originalDraft = drafts.find(d => !d.isKeeper);

  console.log('\n--- ANALYSIS ---');
  if (originalDraft) {
    console.log(`Original Draft: ${originalDraft.draft.season}, Round ${originalDraft.round}`);

    // Calculate correct costs for each keeper record
    for (const k of keepers) {
      const yearsKept = k.season - originalDraft.draft.season;
      const correctBase = originalDraft.round;
      const correctFinal = Math.max(1, correctBase - yearsKept);

      console.log(`\nSeason ${k.season}:`);
      console.log(`  Expected: Base R${correctBase}, Final R${correctFinal}, Years ${yearsKept}`);
      console.log(`  Actual:   Base R${k.baseCost}, Final R${k.finalCost}, Years ${k.yearsKept}`);

      if (k.baseCost !== correctBase || k.finalCost !== correctFinal || k.yearsKept !== yearsKept) {
        console.log(`  ❌ MISMATCH - Needs fix!`);
      } else {
        console.log(`  ✅ Correct`);
      }
    }
  } else {
    console.log('No original draft found - likely undrafted or historical data not synced');
    console.log('Need to determine base cost from league history or sleeper data');
  }
}

async function main() {
  // Investigate problematic players
  await investigatePlayer('Travis Etienne');
  await investigatePlayer('George Pickens');
  await investigatePlayer('Lamar Jackson');
  await investigatePlayer('Michael Wilson');
}

main().catch(console.error).finally(() => prisma.$disconnect());
