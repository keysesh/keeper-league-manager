import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const player = await prisma.player.findFirst({
    where: { sleeperId: '7588' }
  });

  if (!player) {
    console.log('Player not found');
    return;
  }

  console.log('=== JAVONTE WILLIAMS DEEP ANALYSIS ===\n');

  // Get ALL draft picks with full details
  const draftPicks = await prisma.draftPick.findMany({
    where: { playerId: player.id },
    include: {
      draft: {
        select: {
          season: true,
          leagueId: true,
          type: true,
          status: true
        }
      },
      roster: {
        select: {
          teamName: true,
          sleeperId: true,
          ownerId: true
        }
      }
    },
    orderBy: { draft: { season: 'asc' } }
  });

  console.log('=== ALL DRAFT PICKS (including keeper slots) ===');
  draftPicks.forEach(p => {
    console.log(`Season ${p.draft.season}:`);
    console.log(`  Round ${p.round}, Pick #${p.pickNumber}, Slot ${p.draftSlot}`);
    console.log(`  isKeeper: ${p.isKeeper}`);
    console.log(`  Team: ${p.roster?.teamName}`);
    console.log(`  Draft Type: ${p.draft.type}`);
    console.log('');
  });

  // Find the ORIGINAL draft (isKeeper = false)
  const originalDraft = draftPicks.find(p => !p.isKeeper);
  const keeperSlots = draftPicks.filter(p => p.isKeeper);

  console.log('=== ORIGINAL DRAFT vs KEEPER SLOTS ===');
  if (originalDraft) {
    console.log(`ORIGINAL DRAFT: Season ${originalDraft.draft.season}, Round ${originalDraft.round}`);
  } else {
    console.log('NO ORIGINAL DRAFT FOUND - Player may be undrafted or data not synced');
  }
  console.log(`KEEPER SLOTS: ${keeperSlots.length} found`);
  keeperSlots.forEach(k => {
    console.log(`  - Season ${k.draft.season}: Round ${k.round}`);
  });

  // Get ALL keeper records
  const keepers = await prisma.keeper.findMany({
    where: { playerId: player.id },
    include: {
      roster: {
        select: {
          teamName: true,
          sleeperId: true
        }
      }
    },
    orderBy: { season: 'asc' }
  });

  console.log('\n=== ALL KEEPER RECORDS ===');
  keepers.forEach(k => {
    console.log(`Season ${k.season}:`);
    console.log(`  Type: ${k.type}`);
    console.log(`  Base Cost: Round ${k.baseCost}`);
    console.log(`  Final Cost: Round ${k.finalCost}`);
    console.log(`  Years Kept: ${k.yearsKept}`);
    console.log(`  Acquisition: ${k.acquisitionType}`);
    console.log(`  Team: ${k.roster.teamName}`);
    console.log('');
  });

  // Get all transactions for this player
  const transactions = await prisma.transactionPlayer.findMany({
    where: { playerId: player.id },
    include: {
      transaction: {
        select: {
          type: true,
          createdAt: true,
          week: true,
          status: true
        }
      }
    },
    orderBy: { transaction: { createdAt: 'asc' } }
  });

  console.log('=== ALL TRANSACTIONS (chronological) ===');
  transactions.forEach(t => {
    const date = t.transaction.createdAt.toISOString().split('T')[0];
    console.log(`${date}: ${t.transaction.type}`);
    console.log(`  From Roster: ${t.fromRosterId || 'N/A'}`);
    console.log(`  To Roster: ${t.toRosterId || 'N/A'}`);
    console.log('');
  });

  // Calculate correct keeper cost for 2026
  console.log('\n=== 2026 KEEPER COST CALCULATION ===');

  // Get roster mapping
  const rosterMap = new Map<string, string>();
  for (const dp of draftPicks) {
    if (dp.roster?.sleeperId) {
      rosterMap.set(dp.rosterId!, dp.roster.sleeperId);
    }
  }

  if (originalDraft) {
    const baseCost = originalDraft.round;
    const draftYear = originalDraft.draft.season;
    const planYear = 2026;

    // Check if there was an offseason trade that resets years
    const offseasonTrades = transactions.filter(t =>
      t.transaction.type === 'TRADE' &&
      t.toRosterId &&
      t.transaction.createdAt.getMonth() >= 2 && // March or later
      t.transaction.createdAt.getMonth() <= 7    // Before September
    );

    console.log(`Original Draft: ${draftYear}, Round ${baseCost}`);
    console.log(`Planning Season: ${planYear}`);

    if (offseasonTrades.length > 0) {
      const lastTrade = offseasonTrades[offseasonTrades.length - 1];
      const tradeYear = lastTrade.transaction.createdAt.getFullYear();
      console.log(`\nOFFSEASON TRADE DETECTED: ${lastTrade.transaction.createdAt.toISOString().split('T')[0]}`);
      console.log(`Years reset to 0 at trade, but base cost preserved`);

      const yearsKept = planYear - tradeYear;
      const finalCost = Math.max(1, baseCost - yearsKept);
      console.log(`\nYears kept since trade: ${yearsKept}`);
      console.log(`Base cost: Round ${baseCost}`);
      console.log(`Final cost: Round ${finalCost}`);
    } else {
      const yearsKept = planYear - draftYear;
      const finalCost = Math.max(1, baseCost - yearsKept);
      console.log(`\nYears kept: ${yearsKept}`);
      console.log(`Base cost: Round ${baseCost}`);
      console.log(`Final cost: Round ${finalCost}`);
    }
  } else {
    console.log('Cannot calculate - no original draft found');
    console.log('If undrafted, base cost should be the undraftedRound setting (typically R8 or R10)');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
