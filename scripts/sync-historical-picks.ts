import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const HISTORICAL_DRAFTS = [
  // 2023 drafts
  { draftId: "991458483092471808", season: 2023, leagueSleeperId: "991458482647871488" },
  { draftId: "1000550787006709760", season: 2023, leagueSleeperId: "991458482647871488" },
  // 2024 drafts
  { draftId: "1109261023418314753", season: 2024, leagueSleeperId: "1109261023418314752" },
  { draftId: "1133482056543207424", season: 2024, leagueSleeperId: "1109261023418314752" },
  { draftId: "1133490967337836544", season: 2024, leagueSleeperId: "1109261023418314752" },
];

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function syncDraft(config: typeof HISTORICAL_DRAFTS[0]) {
  console.log(`\nSyncing draft ${config.draftId} (${config.season})...`);

  await sleep(1000); // Rate limit

  // Get draft info
  const draft = await fetchJson(`https://api.sleeper.app/v1/draft/${config.draftId}`);
  await sleep(500);

  // Get picks
  const picks = await fetchJson(`https://api.sleeper.app/v1/draft/${config.draftId}/picks`);
  console.log(`  Found ${picks.length} picks`);

  // Get the league DB record
  const league = await prisma.league.findFirst({
    where: { sleeperId: { in: [config.leagueSleeperId, "1256780766516359168"] } }
  });

  if (!league) {
    console.log("  League not found, skipping");
    return { synced: 0, skipped: 0 };
  }

  // Create or get draft record
  let draftRecord = await prisma.draft.findFirst({
    where: { sleeperId: config.draftId }
  });

  if (!draftRecord) {
    draftRecord = await prisma.draft.create({
      data: {
        sleeperId: config.draftId,
        leagueId: league.id,
        season: config.season,
        type: draft.type || "LINEAR",
        status: draft.status || "complete",
        rounds: draft.settings?.rounds || 16,
      }
    });
    console.log(`  Created draft record`);
  }

  let synced = 0;
  let skipped = 0;

  for (const pick of picks) {
    if (!pick.player_id) {
      skipped++;
      continue;
    }

    // Find player
    const player = await prisma.player.findFirst({
      where: { sleeperId: pick.player_id }
    });

    if (!player) {
      skipped++;
      continue;
    }

    // Find roster by picked_by (owner ID) - this matches our roster sleeperId
    const roster = await prisma.roster.findFirst({
      where: {
        leagueId: league.id,
        sleeperId: pick.picked_by,
      }
    });

    if (!roster) {
      skipped++;
      continue;
    }

    const rosterId = roster.id;
    if (!rosterId) {
      skipped++;
      continue;
    }

    // Calculate draft slot from pick number and round
    const draftSlot = ((pick.pick_no - 1) % 12) + 1; // Assuming 12-team league

    // Upsert draft pick using correct unique constraint
    await prisma.draftPick.upsert({
      where: {
        draftId_round_draftSlot: {
          draftId: draftRecord.id,
          round: pick.round,
          draftSlot: draftSlot,
        }
      },
      update: {
        playerId: player.id,
        rosterId: rosterId,
        pickNumber: pick.pick_no,
      },
      create: {
        draftId: draftRecord.id,
        playerId: player.id,
        rosterId: rosterId,
        round: pick.round,
        pickNumber: pick.pick_no,
        draftSlot: draftSlot,
      }
    });

    synced++;
  }

  console.log(`  Synced: ${synced}, Skipped: ${skipped}`);
  return { synced, skipped };
}

async function main() {
  console.log("=== SYNCING HISTORICAL DRAFT PICKS ===");

  let totalSynced = 0;
  let totalSkipped = 0;

  for (const config of HISTORICAL_DRAFTS) {
    try {
      const result = await syncDraft(config);
      totalSynced += result.synced;
      totalSkipped += result.skipped;
    } catch (err) {
      console.log(`  Error: ${err}`);
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Total synced: ${totalSynced}`);
  console.log(`Total skipped: ${totalSkipped}`);

  // Verify
  console.log("\n=== DRAFTS IN DB ===");
  const drafts = await prisma.draft.findMany({
    orderBy: { season: "asc" }
  });

  for (const d of drafts) {
    const count = await prisma.draftPick.count({ where: { draftId: d.id } });
    console.log(`Season ${d.season} (${d.sleeperId}): ${count} picks`);
  }

  await prisma.$disconnect();
}

main();
