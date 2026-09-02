/**
 * Re-derive stored Keeper.baseCost from the keeper cost engine.
 *
 * Keeper.baseCost is written once, when a keeper is saved, and never
 * recomputed afterwards — recalculateAndApplyCascade only touches finalCost.
 * So a correction to the cost engine leaves already-saved rows stale, showing
 * the old price on the saved-keepers views while the eligible-keepers view
 * (which computes live) shows the new one.
 *
 * This script closes that gap by asking lib/keeper/cost.ts for each saved
 * keeper's price and writing it back, then re-running the cascade so finalCost
 * reflects the new base costs. It deliberately delegates to the engine rather
 * than restating the formula, so it cannot drift from it.
 *
 * A season whose draft has already been completed is HISTORY, not a stale
 * computation: those rows record the round each keeper was actually taken at.
 * Rewriting them with today's engine would replace the record of what happened
 * with a retroactive re-pricing under current rules — and the round-trip
 * verification compares saved plans against Sleeper's real draft board, so it
 * would start reporting mismatches against fiction. This script refuses to
 * write to such a season.
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

import { DraftStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { batchComputeKeeperCosts } from "../src/lib/keeper/cost";
import { recalculateAndApplyCascade } from "../src/lib/keeper/cascade";

async function main() {
  const season = Number(process.argv[2]);
  const apply = process.argv.includes("--apply");

  if (!Number.isInteger(season)) {
    console.error("Usage: npx tsx scripts/resync-keeper-base-costs.ts <season> [--apply]");
    process.exit(1);
  }

  const leagues = await prisma.league.findMany({
    where: { season },
    select: { id: true, name: true, keeperSettings: true },
  });

  if (leagues.length === 0) {
    console.log(`No leagues found for season ${season}. Nothing to do.`);
    return;
  }

  for (const league of leagues) {
    const completedDraft = await prisma.draft.findFirst({
      where: { leagueId: league.id, season, status: DraftStatus.COMPLETE },
      select: { id: true, startTime: true },
    });

    const keepers = await prisma.keeper.findMany({
      where: { season, roster: { leagueId: league.id } },
      select: {
        id: true,
        playerId: true,
        baseCost: true,
        player: { select: { fullName: true } },
        roster: { select: { sleeperId: true, teamName: true } },
      },
    });

    console.log(`\n=== ${league.name} (${season}) — ${keepers.length} keepers ===`);

    // The engine batches per owner, so group before asking.
    const byOwner = new Map<string, typeof keepers>();
    for (const k of keepers) {
      if (!k.roster.sleeperId) continue;
      const list = byOwner.get(k.roster.sleeperId);
      if (list) list.push(k);
      else byOwner.set(k.roster.sleeperId, [k]);
    }

    let changed = 0;
    for (const [ownerSleeperId, ownerKeepers] of byOwner) {
      const costs = await batchComputeKeeperCosts(
        ownerKeepers.map((k) => k.playerId),
        ownerSleeperId,
        season,
        league.keeperSettings
      );

      for (const k of ownerKeepers) {
        const cost = costs.get(k.playerId);
        if (!cost || cost.effectiveCost === k.baseCost) continue;

        changed++;
        console.log(
          `  R${k.baseCost} -> R${cost.effectiveCost}  ${k.player.fullName} ` +
            `(${k.roster.teamName ?? "?"}) — ${cost.costBreakdown}`
        );

        if (apply) {
          await prisma.keeper.update({
            where: { id: k.id },
            data: { baseCost: cost.effectiveCost },
          });
        }
      }
    }

    if (changed === 0) {
      console.log("  All base costs already match the engine.");
      continue;
    }

    if (completedDraft) {
      console.log(
        `  REFUSING TO WRITE: the ${season} draft completed on ` +
          `${completedDraft.startTime?.toISOString().slice(0, 10) ?? "an unknown date"}. ` +
          `Those ${changed} differences are the historical record of what was ` +
          `actually drafted, not stale values to correct.`
      );
      continue;
    }

    if (!apply) {
      console.log(`  ${changed} would change. Re-run with --apply to write them.`);
      continue;
    }

    console.log(`  ${changed} updated. Re-running cascade...`);
    const cascade = await recalculateAndApplyCascade(league.id, season);
    if (cascade.errors.length > 0) {
      console.log(`  Cascade warnings: ${cascade.errors.join("; ")}`);
    } else {
      console.log("  Cascade recalculated.");
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
