import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find Javonte Williams
  const player = await prisma.player.findFirst({
    where: {
      OR: [
        { fullName: { contains: 'Javonte Williams', mode: 'insensitive' } },
        { lastName: { contains: 'Williams', mode: 'insensitive' }, firstName: { contains: 'Javonte', mode: 'insensitive' } }
      ]
    }
  });

  if (!player) {
    console.log('Player not found');
    return;
  }

  console.log('\n=== PLAYER INFO ===');
  console.log('ID:', player.id);
  console.log('Sleeper ID:', player.sleeperId);
  console.log('Name:', player.fullName);
  console.log('Position:', player.position);
  console.log('Team:', player.team);
  console.log('Age:', player.age);
  console.log('Years Exp:', player.yearsExp);

  // Get all draft picks for this player
  const draftPicks = await prisma.draftPick.findMany({
    where: { playerId: player.id },
    include: {
      draft: { select: { season: true, leagueId: true } },
      roster: { select: { teamName: true, sleeperId: true } }
    },
    orderBy: { draft: { season: 'asc' } }
  });

  console.log('\n=== DRAFT HISTORY ===');
  if (draftPicks.length === 0) {
    console.log('No draft picks found');
  } else {
    draftPicks.forEach(p => {
      const keeperFlag = p.isKeeper ? ' [KEEPER SLOT]' : '';
      console.log(`Season ${p.draft.season}: Round ${p.round}, Pick #${p.pickNumber}${keeperFlag} | Team: ${p.roster?.teamName || 'Unknown'}`);
    });
  }

  // Get keeper records
  const keepers = await prisma.keeper.findMany({
    where: { playerId: player.id },
    include: {
      roster: { select: { teamName: true, sleeperId: true } }
    },
    orderBy: { season: 'asc' }
  });

  console.log('\n=== KEEPER RECORDS ===');
  if (keepers.length === 0) {
    console.log('No keeper records found');
  } else {
    keepers.forEach(k => {
      console.log(`Season ${k.season}: ${k.type} | Base=R${k.baseCost} → Final=R${k.finalCost} | YearsKept=${k.yearsKept} | Team: ${k.roster.teamName}`);
    });
  }

  // Get transactions
  const transactions = await prisma.transactionPlayer.findMany({
    where: { playerId: player.id },
    include: {
      transaction: { select: { type: true, createdAt: true, week: true } }
    },
    orderBy: { transaction: { createdAt: 'desc' } }
  });

  console.log('\n=== RECENT TRANSACTIONS ===');
  if (transactions.length === 0) {
    console.log('No transactions found');
  } else {
    transactions.slice(0, 10).forEach(t => {
      const date = t.transaction.createdAt.toISOString().split('T')[0];
      console.log(`${date}: ${t.transaction.type} (Week ${t.transaction.week}) | From: ${t.fromRosterId || 'FA'} → To: ${t.toRosterId || 'Dropped'}`);
    });
  }

  // Calculate expected keeper cost
  console.log('\n=== KEEPER COST ANALYSIS ===');

  // Find original (non-keeper) draft pick
  const originalDraft = draftPicks.find(p => !p.isKeeper);
  if (originalDraft) {
    console.log(`Original Draft: Season ${originalDraft.draft.season}, Round ${originalDraft.round}`);

    const currentPlanSeason = 2026; // getKeeperPlanningSeason()
    const yearsKept = currentPlanSeason - originalDraft.draft.season;
    const baseCost = originalDraft.round;
    const finalCost = Math.max(1, baseCost - yearsKept);

    console.log(`\nIf kept continuously since ${originalDraft.draft.season}:`);
    console.log(`  Years on roster: ${yearsKept}`);
    console.log(`  Base cost: Round ${baseCost}`);
    console.log(`  Cost reduction: -${yearsKept} rounds`);
    console.log(`  Final cost: Round ${finalCost}`);
  } else {
    console.log('No original draft found - player may be undrafted or traded');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
