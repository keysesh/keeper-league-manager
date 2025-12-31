import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== KEEPER VERIFICATION ===\n');

  // Get all keeper records
  const keepers = await prisma.keeper.findMany({
    include: {
      player: { select: { fullName: true, sleeperId: true } },
      roster: { select: { teamName: true, leagueId: true } }
    },
    orderBy: [{ season: 'desc' }, { roster: { teamName: 'asc' } }]
  });

  console.log('=== ALL KEEPER RECORDS ===\n');

  let currentTeam = '';
  for (const k of keepers) {
    if (k.roster.teamName !== currentTeam) {
      currentTeam = k.roster.teamName || 'Unknown';
      console.log(`\n📋 ${currentTeam}`);
      console.log('─'.repeat(60));
    }

    const typeEmoji = k.type === 'FRANCHISE' ? '🏷️' : '📌';
    console.log(`  ${typeEmoji} ${k.player.fullName} (${k.season})`);
    console.log(`     Base: R${k.baseCost} | Final: R${k.finalCost} | Years: ${k.yearsKept} | ${k.acquisitionType}`);
  }

  // Check players without draft history
  console.log('\n\n=== PLAYERS WITHOUT DRAFT HISTORY ===\n');

  const playersWithoutDrafts = ['Travis Etienne', 'Lamar Jackson', 'George Pickens'];

  for (const name of playersWithoutDrafts) {
    const player = await prisma.player.findFirst({
      where: { fullName: { contains: name, mode: 'insensitive' } }
    });

    if (!player) continue;

    // Check ALL draft picks across all leagues
    const allDrafts = await prisma.draftPick.findMany({
      where: { playerId: player.id },
      include: {
        draft: { select: { season: true, leagueId: true } },
        roster: { select: { teamName: true } }
      },
      orderBy: { draft: { season: 'asc' } }
    });

    console.log(`${name}:`);
    if (allDrafts.length === 0) {
      console.log('  ❌ No draft picks found in any league');
    } else {
      allDrafts.forEach(d => {
        const keeperFlag = d.isKeeper ? ' [KEEPER SLOT]' : '';
        console.log(`  Season ${d.draft.season}: R${d.round}${keeperFlag} - ${d.roster?.teamName}`);
      });
    }

    // Check keeper records
    const keeperRecords = await prisma.keeper.findMany({
      where: { playerId: player.id },
      include: { roster: { select: { teamName: true } } }
    });

    console.log(`  Keeper records: ${keeperRecords.length}`);
    keeperRecords.forEach(k => {
      console.log(`    ${k.season}: ${k.type} R${k.baseCost}→R${k.finalCost} (${k.roster.teamName})`);
    });
    console.log('');
  }

  // Specifically check Javonte Williams current status
  console.log('\n=== JAVONTE WILLIAMS VERIFICATION ===\n');

  const javonte = await prisma.player.findFirst({
    where: { sleeperId: '7588' }
  });

  if (javonte) {
    const javonteKeepers = await prisma.keeper.findMany({
      where: { playerId: javonte.id },
      include: { roster: { select: { teamName: true } } }
    });

    const javonteDrafts = await prisma.draftPick.findMany({
      where: { playerId: javonte.id },
      include: { draft: { select: { season: true } }, roster: { select: { teamName: true } } }
    });

    console.log('Draft History:');
    javonteDrafts.forEach(d => {
      const keeperFlag = d.isKeeper ? ' [KEEPER SLOT]' : '';
      console.log(`  ${d.draft.season}: R${d.round}${keeperFlag} - ${d.roster?.teamName}`);
    });

    console.log('\nKeeper Records:');
    javonteKeepers.forEach(k => {
      console.log(`  ${k.season}: ${k.type} | Base R${k.baseCost} → Final R${k.finalCost} | Years ${k.yearsKept}`);
    });

    // Calculate what 2026 should be
    const original = javonteDrafts.find(d => !d.isKeeper);
    if (original) {
      const yearsFor2026 = 2026 - original.draft.season;
      const finalFor2026 = Math.max(1, original.round - yearsFor2026);
      console.log(`\n✅ For 2026: Should be Round ${finalFor2026} (R${original.round} - ${yearsFor2026} years)`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
