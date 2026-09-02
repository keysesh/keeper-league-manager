/**
 * Re-derive stored Keeper.baseCost from the keeper cost engine.
 *
 * Thin CLI over lib/keeper/resync-base-costs.ts, which is the same code the
 * cron runs after it rebuilds the acquisition chain. See that module for why
 * saved rows go stale and why a completed season is refused.
 *
 * Dry run (default):  npx tsx scripts/resync-keeper-base-costs.ts <season>
 * Apply:              npx tsx scripts/resync-keeper-base-costs.ts <season> --apply
 */

import { config } from "dotenv";
config({ path: "../.env.local" });
config({ path: ".env.local" });
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.trim();
}

import { prisma } from "../src/lib/prisma";
import { resyncKeeperBaseCosts } from "../src/lib/keeper/resync-base-costs";

async function main() {
  const season = Number(process.argv[2]);
  const apply = process.argv.includes("--apply");

  if (!Number.isInteger(season)) {
    console.error("Usage: npx tsx scripts/resync-keeper-base-costs.ts <season> [--apply]");
    process.exit(1);
  }

  const leagues = await prisma.league.findMany({
    where: { season },
    select: { id: true, name: true },
  });

  if (leagues.length === 0) {
    console.log(`No leagues found for season ${season}. Nothing to do.`);
    return;
  }

  for (const league of leagues) {
    const result = await resyncKeeperBaseCosts(league.id, season, { apply });

    console.log(`\n=== ${league.name} (${season}) ===`);

    if (result.skipped === "no-keepers") {
      console.log("  No keepers saved for this season.");
      continue;
    }

    for (const c of result.changes) {
      console.log(`  R${c.from} -> R${c.to}  ${c.playerName} (${c.teamName ?? "?"}) — ${c.breakdown}`);
    }

    if (result.skipped === "draft-complete") {
      console.log(
        `  REFUSING TO WRITE: the ${season} draft is already complete. Those ` +
          `${result.changes.length} differences are the historical record of ` +
          `what was actually drafted, not stale values to correct.`
      );
      continue;
    }

    if (result.changes.length === 0) {
      console.log("  All base costs already match the engine.");
      continue;
    }

    if (!apply) {
      console.log(`  ${result.changes.length} would change. Re-run with --apply to write them.`);
      continue;
    }

    console.log(`  ${result.written} updated, cascade recalculated.`);
    if (result.cascadeErrors.length > 0) {
      console.log(`  Cascade warnings: ${result.cascadeErrors.join("; ")}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
