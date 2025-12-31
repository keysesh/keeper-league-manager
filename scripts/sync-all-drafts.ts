import { PrismaClient, Prisma } from "@prisma/client";
import { SleeperClient } from "../src/lib/sleeper/client";

const prisma = new PrismaClient();
const sleeper = new SleeperClient();

async function syncAllDrafts() {
  console.log("=== SYNCING ALL DRAFTS ===\n");

  // Get all E Pluribus Gridiron Dynasty leagues
  const leagues = await prisma.league.findMany({
    where: { name: { contains: "E Pluribus" } },
    orderBy: { season: "desc" },
  });

  console.log(`Found ${leagues.length} leagues\n`);

  for (const league of leagues) {
    console.log(`\n========== ${league.name} (${league.season}) ==========`);
    console.log(`Sleeper ID: ${league.sleeperId}`);

    // Get DB rosters for this league
    const dbRosters = await prisma.roster.findMany({
      where: { leagueId: league.id },
      select: { id: true, sleeperId: true, teamName: true },
    });

    // Get Sleeper rosters to build slot mapping
    const sleeperRosters = await sleeper.getRosters(league.sleeperId);
    const slotToOwnerMap = new Map<number, string>();
    for (const sr of sleeperRosters) {
      if (sr.owner_id) {
        slotToOwnerMap.set(sr.roster_id, sr.owner_id);
      }
    }

    // Build slot -> dbRosterId mapping
    const slotToDbRosterId = new Map<number, string>();
    for (const [slot, ownerId] of slotToOwnerMap) {
      const dbRoster = dbRosters.find((r) => r.sleeperId === ownerId);
      if (dbRoster) {
        slotToDbRosterId.set(slot, dbRoster.id);
      }
    }

    console.log(`Rosters mapped: ${slotToDbRosterId.size}/${slotToOwnerMap.size}`);

    // Get drafts
    const drafts = await sleeper.getDrafts(league.sleeperId);
    console.log(`Found ${drafts.length} drafts`);

    for (const draftData of drafts) {
      // Skip empty drafts or rookie drafts (only process main drafts)
      if (draftData.status !== "complete") {
        console.log(`  Skipping draft ${draftData.draft_id} (status: ${draftData.status})`);
        continue;
      }

      const picks = await sleeper.getDraftPicks(draftData.draft_id);
      if (picks.length === 0) {
        console.log(`  Skipping draft ${draftData.draft_id} (no picks)`);
        continue;
      }

      console.log(`\n  Draft ${draftData.draft_id} (${draftData.season}): ${picks.length} picks`);

      // Upsert draft
      const draft = await prisma.draft.upsert({
        where: { sleeperId: draftData.draft_id },
        update: {
          status: "COMPLETE",
        },
        create: {
          sleeperId: draftData.draft_id,
          leagueId: league.id,
          season: parseInt(draftData.season),
          type: draftData.type === "auction" ? "AUCTION" : draftData.type === "linear" ? "LINEAR" : "SNAKE",
          status: "COMPLETE",
          rounds: typeof draftData.settings?.rounds === "number" ? draftData.settings.rounds : 16,
          draftOrder: Prisma.JsonNull,
          settings: Prisma.JsonNull,
        },
      });

      // Get player map
      const playerSleeperIds = picks.filter((p) => p.player_id).map((p) => p.player_id!);
      const players = await prisma.player.findMany({
        where: { sleeperId: { in: playerSleeperIds } },
        select: { id: true, sleeperId: true },
      });
      const playerMap = new Map(players.map((p) => [p.sleeperId, p.id]));

      let created = 0;
      let keeperCount = 0;

      for (const pick of picks) {
        const dbRosterId = slotToDbRosterId.get(parseInt(pick.roster_id));
        if (!dbRosterId) continue;

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
        } catch {
          // Ignore errors
        }
      }

      console.log(`    Synced: ${created} picks, ${keeperCount} keepers`);
    }
  }

  // Summary
  console.log("\n\n=== SUMMARY ===");
  const totalPicks = await prisma.draftPick.count();
  const keeperPicks = await prisma.draftPick.findMany({
    where: { isKeeper: true },
    include: {
      player: { select: { fullName: true } },
      roster: { select: { teamName: true } },
      draft: { select: { season: true } },
    },
    orderBy: [{ draft: { season: "desc" } }, { round: "asc" }],
  });

  console.log(`Total draft picks: ${totalPicks}`);
  console.log(`\nKeeper-marked picks (${keeperPicks.length}):`);

  let currentSeason = 0;
  for (const p of keeperPicks) {
    if (p.draft.season !== currentSeason) {
      currentSeason = p.draft.season;
      console.log(`\n  --- ${currentSeason} ---`);
    }
    console.log(`    R${p.round}: ${p.player?.fullName || "?"} (${p.roster.teamName})`);
  }

  await prisma.$disconnect();
}

syncAllDrafts().catch(console.error);
