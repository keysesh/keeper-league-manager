import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEAGUE_IDS = {
  2025: "1256780766516359168",
  2024: "1109261023418314752",
  2023: "991458482647871488",
};

const DRAFT_IDS = {
  2025: "1256780766528929792",
  2024: ["1109261023418314753", "1133482056543207424", "1133490967337836544"],
  2023: ["991458483092471808", "1000550787006709760"],
};

async function fetchJson(url: string) {
  const res = await fetch(url);
  return res.json();
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getPlayerHistory(sleeperId: string) {
  const history: {
    season: number;
    rosterId: number;
    ownerId: string;
    draftRound?: number;
    draftId?: string;
  }[] = [];

  // Check rosters for each season
  for (const [season, leagueId] of Object.entries(LEAGUE_IDS)) {
    await sleep(500);
    const rosters = await fetchJson(
      `https://api.sleeper.app/v1/league/${leagueId}/rosters`
    );

    for (const roster of rosters) {
      if (roster.players && roster.players.includes(sleeperId)) {
        history.push({
          season: parseInt(season),
          rosterId: roster.roster_id,
          ownerId: roster.owner_id,
        });
        break;
      }
    }
  }

  // Check drafts for original draft round
  for (const [season, draftIds] of Object.entries(DRAFT_IDS)) {
    const ids = Array.isArray(draftIds) ? draftIds : [draftIds];
    for (const draftId of ids) {
      await sleep(500);
      const picks = await fetchJson(
        `https://api.sleeper.app/v1/draft/${draftId}/picks`
      );

      for (const pick of picks) {
        if (pick.player_id === sleeperId) {
          // Find if we already have this season in history
          const existing = history.find((h) => h.season === parseInt(season));
          if (existing) {
            existing.draftRound = pick.round;
            existing.draftId = draftId;
          } else {
            history.push({
              season: parseInt(season),
              rosterId: pick.roster_id,
              ownerId: pick.picked_by,
              draftRound: pick.round,
              draftId: draftId,
            });
          }
          break;
        }
      }
    }
  }

  return history.sort((a, b) => a.season - b.season);
}

async function main() {
  // Get all 2025 keepers
  const keepers = await prisma.keeper.findMany({
    where: { season: 2025 },
    include: {
      player: true,
      roster: true,
    },
  });

  console.log("=== VERIFYING 2025 KEEPERS ===\n");

  const issues: string[] = [];

  for (const keeper of keepers) {
    const sleeperId = keeper.player?.sleeperId;
    const playerName = keeper.player?.fullName;
    const currentOwner = keeper.roster?.sleeperId;

    if (!sleeperId) continue;

    console.log(`Checking ${playerName} (${sleeperId})...`);

    const history = await getPlayerHistory(sleeperId);

    // Find original draft
    const originalDraft = history.find((h) => h.draftRound);

    // Find how long on current owner's roster
    const onCurrentOwner = history.filter((h) => h.ownerId === currentOwner);
    const firstYearWithOwner = onCurrentOwner[0]?.season;
    const yearsWithOwner = firstYearWithOwner
      ? 2025 - firstYearWithOwner + 1
      : 1;

    // Determine correct values
    let correctBaseCost = 8; // default undrafted
    if (originalDraft) {
      correctBaseCost = originalDraft.draftRound!;
    }

    // For 2025 keeper, yearsKept should be years on this owner's roster
    const correctYearsKept = yearsWithOwner;
    const correctFinalCost = Math.max(1, correctBaseCost - (correctYearsKept - 1));

    // Check for issues
    const hasIssue =
      keeper.baseCost !== correctBaseCost ||
      keeper.yearsKept !== correctYearsKept ||
      keeper.finalCost !== correctFinalCost;

    if (hasIssue) {
      console.log(`  ISSUE FOUND:`);
      console.log(
        `    Current: baseCost=R${keeper.baseCost}, yearsKept=${keeper.yearsKept}, finalCost=R${keeper.finalCost}`
      );
      console.log(
        `    Correct: baseCost=R${correctBaseCost}, yearsKept=${correctYearsKept}, finalCost=R${correctFinalCost}`
      );
      console.log(`    History: ${JSON.stringify(history)}`);
      issues.push(
        `${playerName}: baseCost R${keeper.baseCost}→R${correctBaseCost}, yearsKept ${keeper.yearsKept}→${correctYearsKept}, finalCost R${keeper.finalCost}→R${correctFinalCost}`
      );
    } else {
      console.log(`  OK`);
    }

    console.log("");
  }

  console.log("\n=== SUMMARY ===");
  if (issues.length === 0) {
    console.log("All keepers verified correctly!");
  } else {
    console.log(`Found ${issues.length} issues:`);
    for (const issue of issues) {
      console.log(`  - ${issue}`);
    }
  }

  await prisma.$disconnect();
}

main();
