import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== KEEPER COST AUDIT & FIX ===\n');

  // Get all keeper records for 2025 and 2026
  const keepers = await prisma.keeper.findMany({
    where: {
      season: { in: [2025, 2026] }
    },
    include: {
      player: {
        select: {
          id: true,
          fullName: true,
          sleeperId: true
        }
      },
      roster: {
        select: {
          teamName: true,
          leagueId: true,
          sleeperId: true
        }
      }
    }
  });

  console.log(`Found ${keepers.length} keeper records to audit\n`);

  const issues: Array<{
    keeperId: string;
    playerName: string;
    teamName: string;
    season: number;
    currentBase: number;
    correctBase: number;
    currentFinal: number;
    correctFinal: number;
    yearsKept: number;
  }> = [];

  for (const keeper of keepers) {
    // Find the original draft pick for this player (isKeeper = false)
    const originalDraft = await prisma.draftPick.findFirst({
      where: {
        playerId: keeper.playerId,
        isKeeper: false,
        draft: {
          leagueId: keeper.roster.leagueId
        }
      },
      include: {
        draft: { select: { season: true } }
      },
      orderBy: { draft: { season: 'asc' } }
    });

    if (!originalDraft) {
      // No original draft - check if undrafted (should use undraftedRound)
      // Get league settings
      const settings = await prisma.keeperSettings.findUnique({
        where: { leagueId: keeper.roster.leagueId }
      });
      const undraftedRound = settings?.undraftedRound ?? 8;

      // For undrafted players, base should be undraftedRound
      if (keeper.baseCost !== undraftedRound) {
        console.log(`⚠️  ${keeper.player.fullName} - No draft found, may be undrafted`);
        console.log(`   Current base: R${keeper.baseCost}, Expected: R${undraftedRound} (undrafted)`);
      }
      continue;
    }

    const correctBaseCost = originalDraft.round;
    const draftYear = originalDraft.draft.season;
    const yearsKept = keeper.season - draftYear;

    // Get minimum round from settings
    const settings = await prisma.keeperSettings.findUnique({
      where: { leagueId: keeper.roster.leagueId }
    });
    const minRound = settings?.minimumRound ?? 1;

    const correctFinalCost = Math.max(minRound, correctBaseCost - yearsKept);

    // Check for mismatch
    if (keeper.baseCost !== correctBaseCost || keeper.finalCost !== correctFinalCost) {
      issues.push({
        keeperId: keeper.id,
        playerName: keeper.player.fullName,
        teamName: keeper.roster.teamName || 'Unknown',
        season: keeper.season,
        currentBase: keeper.baseCost,
        correctBase: correctBaseCost,
        currentFinal: keeper.finalCost,
        correctFinal: correctFinalCost,
        yearsKept: yearsKept
      });
    }
  }

  console.log('\n=== MISMATCHED RECORDS ===\n');

  if (issues.length === 0) {
    console.log('✅ No mismatched keeper records found!');
    return;
  }

  console.log(`Found ${issues.length} keeper records with incorrect costs:\n`);

  for (const issue of issues) {
    console.log(`❌ ${issue.playerName} (${issue.teamName}) - Season ${issue.season}`);
    console.log(`   Base Cost:  R${issue.currentBase} → R${issue.correctBase}`);
    console.log(`   Final Cost: R${issue.currentFinal} → R${issue.correctFinal}`);
    console.log(`   Years Kept: ${issue.yearsKept}`);
    console.log('');
  }

  // Fix the issues
  console.log('\n=== FIXING RECORDS ===\n');

  for (const issue of issues) {
    await prisma.keeper.update({
      where: { id: issue.keeperId },
      data: {
        baseCost: issue.correctBase,
        finalCost: issue.correctFinal,
        yearsKept: issue.yearsKept
      }
    });
    console.log(`✅ Fixed ${issue.playerName}: R${issue.currentBase}→R${issue.correctBase}, Final R${issue.currentFinal}→R${issue.correctFinal}`);
  }

  console.log(`\n✅ Fixed ${issues.length} keeper records!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
