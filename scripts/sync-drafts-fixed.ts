import { PrismaClient, Prisma } from "@prisma/client";
import { SleeperClient } from "../src/lib/sleeper/client";

const prisma = new PrismaClient();
const sleeper = new SleeperClient();

async function syncDraftsFixed() {
  console.log("=== SYNCING DRAFTS (FIXED ROSTER MAPPING) ===\n");

  // Focus on main league
  const league = await prisma.league.findFirst({
    where: { sleeperId: "1256780766516359168" },
  });

  if (!league) {
    console.log("League not found");
    return;
  }

  console.log(`League: ${league.name} (${league.season})`);
  console.log(`Sleeper ID: ${league.sleeperId}\n`);

  // Get our DB rosters
  const dbRosters = await prisma.roster.findMany({
    where: { leagueId: league.id },
    select: { id: true, sleeperId: true, teamName: true },
  });
  console.log("DB Rosters:");
  for (const r of dbRosters) {
    console.log(`  ${r.teamName}: sleeperId=${r.sleeperId}, id=${r.id}`);
  }

  // Get Sleeper rosters to build the mapping
  const sleeperRosters = await sleeper.getRosters(league.sleeperId);
  console.log("\nSleeper Rosters (slot -> owner_id):");
  const slotToOwnerMap = new Map<number, string>();
  for (const sr of sleeperRosters) {
    console.log(`  Slot ${sr.roster_id}: owner_id=${sr.owner_id}`);
    if (sr.owner_id) {
      slotToOwnerMap.set(sr.roster_id, sr.owner_id);
    }
  }

  // Build the final mapping: slot -> dbRosterId
  const slotToDbRosterId = new Map<number, string>();
  for (const [slot, ownerId] of slotToOwnerMap) {
    const dbRoster = dbRosters.find((r) => r.sleeperId === ownerId);
    if (dbRoster) {
      slotToDbRosterId.set(slot, dbRoster.id);
    }
  }
  console.log("\nSlot to DB Roster mapping:");
  for (const [slot, dbId] of slotToDbRosterId) {
    const roster = dbRosters.find((r) => r.id === dbId);
    console.log(`  Slot ${slot} -> ${roster?.teamName} (${dbId})`);
  }

  // Get drafts
  const drafts = await sleeper.getDrafts(league.sleeperId);
  console.log(`\nFound ${drafts.length} drafts\n`);

  for (const draftData of drafts) {
    console.log(`--- Draft ${draftData.draft_id} (${draftData.season}) ---`);

    // Upsert draft
    const draft = await prisma.draft.upsert({
      where: { sleeperId: draftData.draft_id },
      update: {
        status: draftData.status === "complete" ? "COMPLETE" : draftData.status === "drafting" ? "DRAFTING" : "PRE_DRAFT",
      },
      create: {
        sleeperId: draftData.draft_id,
        leagueId: league.id,
        season: parseInt(draftData.season),
        type: draftData.type === "auction" ? "AUCTION" : draftData.type === "linear" ? "LINEAR" : "SNAKE",
        status: draftData.status === "complete" ? "COMPLETE" : draftData.status === "drafting" ? "DRAFTING" : "PRE_DRAFT",
        rounds: typeof draftData.settings?.rounds === "number" ? draftData.settings.rounds : 16,
        draftOrder: Prisma.JsonNull,
        settings: Prisma.JsonNull,
      },
    });

    // Get picks
    const picks = await sleeper.getDraftPicks(draftData.draft_id);
    console.log(`  ${picks.length} picks from Sleeper`);

    // Get player map
    const playerSleeperIds = picks.filter((p) => p.player_id).map((p) => p.player_id!);
    const players = await prisma.player.findMany({
      where: { sleeperId: { in: playerSleeperIds } },
      select: { id: true, sleeperId: true },
    });
    const playerMap = new Map(players.map((p) => [p.sleeperId, p.id]));

    let created = 0;
    let skipped = 0;
    let keeperCount = 0;

    for (const pick of picks) {
      // Map roster_id (slot) to DB roster ID
      const dbRosterId = slotToDbRosterId.get(parseInt(pick.roster_id));

      if (!dbRosterId) {
        skipped++;
        continue;
      }

      const playerId = pick.player_id ? playerMap.get(pick.player_id) || null : null;

      try {
        await prisma.draftPick.upsert({
          where: {
            draftId_round_draftSlot: {
              draftId: draft.id,
              round: pick.round,
              draftSlot: pick.draft_slot,
            },
          },
          update: {
            rosterId: dbRosterId,
            playerId,
            pickNumber: pick.pick_no,
            isKeeper: pick.is_keeper || false,
          },
          create: {
            draftId: draft.id,
            rosterId: dbRosterId,
            playerId,
            round: pick.round,
            pickNumber: pick.pick_no,
            draftSlot: pick.draft_slot,
            isKeeper: pick.is_keeper || false,
            metadata: Prisma.JsonNull,
          },
        });
        created++;
        if (pick.is_keeper) keeperCount++;
      } catch (err) {
        console.log(`    Error: ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log(`  Created: ${created}, Skipped: ${skipped}, Keepers: ${keeperCount}`);
  }

  // Show keeper picks
  console.log("\n=== KEEPER PICKS ===");
  const keeperPicks = await prisma.draftPick.findMany({
    where: {
      isKeeper: true,
      draft: { leagueId: league.id },
    },
    include: {
      player: { select: { fullName: true } },
      roster: { select: { teamName: true } },
      draft: { select: { season: true } },
    },
    orderBy: [{ draft: { season: "desc" } }, { round: "asc" }],
  });

  console.log(`Found ${keeperPicks.length} keeper-marked picks:`);
  for (const p of keeperPicks) {
    console.log(`  ${p.draft.season} R${p.round}: ${p.player?.fullName || "?"} (${p.roster.teamName})`);
  }

  await prisma.$disconnect();
}

syncDraftsFixed().catch(console.error);
