import { PrismaClient, Prisma } from "@prisma/client";
import { SleeperClient } from "../src/lib/sleeper/client";

const prisma = new PrismaClient();
const sleeper = new SleeperClient();

async function syncDraftsOnly() {
  console.log("=== SYNCING DRAFTS ONLY ===\n");

  // Get all leagues in our DB
  const leagues = await prisma.league.findMany({
    orderBy: { season: "desc" },
  });

  console.log(`Found ${leagues.length} leagues\n`);

  for (const league of leagues) {
    console.log(`\n--- ${league.name} (${league.season}) ---`);
    console.log(`Sleeper ID: ${league.sleeperId}`);

    try {
      // Get drafts from Sleeper
      const drafts = await sleeper.getDrafts(league.sleeperId);
      console.log(`Found ${drafts.length} drafts`);

      for (const draftData of drafts) {
        console.log(`  Draft ${draftData.draft_id} (${draftData.season}, ${draftData.status})`);

        // Get draft picks
        const picks = await sleeper.getDraftPicks(draftData.draft_id);
        console.log(`    ${picks.length} picks`);

        // Upsert draft
        const draft = await prisma.draft.upsert({
          where: { sleeperId: draftData.draft_id },
          update: {
            status: draftData.status === "complete" ? "COMPLETE" : draftData.status === "drafting" ? "DRAFTING" : "PRE_DRAFT",
            startTime: draftData.start_time ? new Date(draftData.start_time) : null,
          },
          create: {
            sleeperId: draftData.draft_id,
            leagueId: league.id,
            season: parseInt(draftData.season),
            type: draftData.type === "auction" ? "AUCTION" : draftData.type === "linear" ? "LINEAR" : "SNAKE",
            status: draftData.status === "complete" ? "COMPLETE" : draftData.status === "drafting" ? "DRAFTING" : "PRE_DRAFT",
            startTime: draftData.start_time ? new Date(draftData.start_time) : null,
            rounds: typeof draftData.settings?.rounds === "number" ? draftData.settings.rounds : 16,
            draftOrder: draftData.slot_to_roster_id
              ? (draftData.slot_to_roster_id as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            settings: draftData.settings
              ? (draftData.settings as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          },
        });

        // Get rosters and players for mapping
        const rosters = await prisma.roster.findMany({
          where: { leagueId: league.id },
          select: { id: true, sleeperId: true },
        });
        const rosterMap = new Map(rosters.map((r) => [r.sleeperId, r.id]));

        const playerSleeperIds = picks.filter((p) => p.player_id).map((p) => p.player_id!);
        const players = await prisma.player.findMany({
          where: { sleeperId: { in: playerSleeperIds } },
          select: { id: true, sleeperId: true },
        });
        const playerMap = new Map(players.map((p) => [p.sleeperId, p.id]));

        // Sync picks
        let picksCreated = 0;
        let keeperPicks = 0;
        for (const pick of picks) {
          // Map roster - Sleeper uses slot numbers (1-10), we need to map via slot_to_roster_id
          let rosterId: string | undefined;

          // First try direct roster_id lookup (owner_id based)
          // Then try slot mapping from draft order
          const slotMap = draftData.slot_to_roster_id as Record<string, number> | null;
          if (slotMap) {
            // Find which slot this roster_id corresponds to
            for (const [slot, rId] of Object.entries(slotMap)) {
              if (rId === parseInt(pick.roster_id)) {
                // Now find the roster by matching owner_id
                const matchingRoster = rosters.find((r) => r.sleeperId === String(rId));
                if (matchingRoster) {
                  rosterId = matchingRoster.id;
                  break;
                }
              }
            }
          }

          // Fallback: try matching by roster_id directly
          if (!rosterId) {
            rosterId = rosterMap.get(String(pick.roster_id));
          }

          if (!rosterId) {
            // console.log(`      Skipping pick - no roster match for ${pick.roster_id}`);
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
                rosterId,
                playerId,
                pickNumber: pick.pick_no,
                isKeeper: pick.is_keeper || false,
                metadata: pick.metadata
                  ? (pick.metadata as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
              },
              create: {
                draftId: draft.id,
                rosterId,
                playerId,
                round: pick.round,
                pickNumber: pick.pick_no,
                draftSlot: pick.draft_slot,
                isKeeper: pick.is_keeper || false,
                metadata: pick.metadata
                  ? (pick.metadata as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
              },
            });
            picksCreated++;
            if (pick.is_keeper) keeperPicks++;
          } catch (err) {
            // Ignore duplicate errors
          }
        }
        console.log(`    Synced ${picksCreated} picks (${keeperPicks} marked as keepers)`);
      }
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  const totalDrafts = await prisma.draft.count();
  const totalPicks = await prisma.draftPick.count();
  const keeperMarkedPicks = await prisma.draftPick.count({ where: { isKeeper: true } });

  console.log(`Total drafts: ${totalDrafts}`);
  console.log(`Total picks: ${totalPicks}`);
  console.log(`Picks marked as keepers: ${keeperMarkedPicks}`);

  await prisma.$disconnect();
}

syncDraftsOnly().catch(console.error);
