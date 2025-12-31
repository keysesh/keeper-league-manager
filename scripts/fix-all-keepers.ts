import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Historical draft data found from Sleeper API
const ORIGINAL_DRAFTS: Record<string, { season: number; round: number }> = {
  '7543': { season: 2023, round: 6 },  // Travis Etienne - 2023 R6
  '8137': { season: 2023, round: 6 },  // George Pickens - 2023 R6
  // Lamar Jackson (6994) - not found in 2023/2024, likely long-term keeper
  // Michael Wilson (10232) - not found in 2023/2024, likely FA pickup
};

async function main() {
  console.log('=== FIXING ALL KEEPER RECORDS ===\n');

  // Get keeper settings for undrafted round
  const settings = await prisma.keeperSettings.findFirst();
  const undraftedRound = settings?.undraftedRound ?? 8;
  const minRound = settings?.minimumRound ?? 1;

  console.log(`League Settings: Undrafted Round = R${undraftedRound}, Min Round = R${minRound}\n`);

  // Get all keepers
  const keepers = await prisma.keeper.findMany({
    include: {
      player: { select: { fullName: true, sleeperId: true } },
      roster: { select: { teamName: true } }
    }
  });

  console.log(`Found ${keepers.length} keeper records\n`);

  let fixed = 0;
  let skipped = 0;

  for (const keeper of keepers) {
    const sleeperId = keeper.player.sleeperId;
    const originalDraft = ORIGINAL_DRAFTS[sleeperId];

    let correctBase: number;
    let correctYearsKept: number;
    let correctFinal: number;
    let note = '';

    if (originalDraft) {
      // We have historical data
      correctBase = originalDraft.round;
      correctYearsKept = keeper.season - originalDraft.season;
      correctFinal = Math.max(minRound, correctBase - correctYearsKept);
      note = `(from ${originalDraft.season} R${originalDraft.round} draft)`;
    } else if (keeper.type === 'FRANCHISE') {
      // Franchise tag without draft history - likely long-term keeper
      // Keep existing base, just verify final cost formula
      correctBase = keeper.baseCost;
      correctYearsKept = keeper.yearsKept;
      correctFinal = Math.max(minRound, correctBase - correctYearsKept);
      note = '(FT - keeping existing base)';
    } else {
      // Regular keeper without draft history - likely FA/waiver
      correctBase = undraftedRound;
      correctYearsKept = keeper.yearsKept;
      correctFinal = Math.max(minRound, correctBase - correctYearsKept);
      note = '(no draft found - using undrafted)';
    }

    const needsFix =
      keeper.baseCost !== correctBase ||
      keeper.yearsKept !== correctYearsKept ||
      keeper.finalCost !== correctFinal;

    if (needsFix) {
      console.log(`\n❌ ${keeper.player.fullName} (${keeper.roster.teamName}) - ${keeper.season}`);
      console.log(`   Current:  Base R${keeper.baseCost} → Final R${keeper.finalCost}, Years ${keeper.yearsKept}`);
      console.log(`   Correct:  Base R${correctBase} → Final R${correctFinal}, Years ${correctYearsKept} ${note}`);

      await prisma.keeper.update({
        where: { id: keeper.id },
        data: {
          baseCost: correctBase,
          finalCost: correctFinal,
          yearsKept: correctYearsKept
        }
      });

      console.log(`   ✅ Fixed!`);
      fixed++;
    } else {
      skipped++;
    }
  }

  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Already correct: ${skipped}`);

  // Verify final state
  console.log('\n\n=== FINAL STATE ===\n');

  const finalKeepers = await prisma.keeper.findMany({
    include: {
      player: { select: { fullName: true } },
      roster: { select: { teamName: true } }
    },
    orderBy: [{ roster: { teamName: 'asc' } }, { season: 'desc' }]
  });

  let currentTeam = '';
  for (const k of finalKeepers) {
    if (k.roster.teamName !== currentTeam) {
      currentTeam = k.roster.teamName || 'Unknown';
      console.log(`\n📋 ${currentTeam}`);
    }
    const type = k.type === 'FRANCHISE' ? '🏷️' : '📌';
    console.log(`  ${type} ${k.player.fullName} (${k.season}): R${k.baseCost} → R${k.finalCost}, Yrs ${k.yearsKept}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
