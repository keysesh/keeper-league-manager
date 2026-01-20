import { PrismaClient } from "@prisma/client";

async function fetchSleeper(endpoint: string) {
  const res = await fetch("https://api.sleeper.app/v1" + endpoint);
  return res.json();
}

async function main() {
  const prisma = new PrismaClient();

  try {
    // Get all leagues
    const leagues = await prisma.league.findMany({
      where: { season: 2025 },
    });

    for (const league of leagues) {
      console.log("\nSyncing traded picks for:", league.name);

      // Fetch from Sleeper
      const [tradedPicks, sleeperRosters] = await Promise.all([
        fetchSleeper("/league/" + league.sleeperId + "/traded_picks"),
        fetchSleeper("/league/" + league.sleeperId + "/rosters"),
      ]);

      console.log("Found", tradedPicks.length, "traded picks from Sleeper");

      // Build slot to owner map
      const slotToOwnerMap = new Map<number, string>();
      for (const roster of sleeperRosters) {
        if (roster.owner_id) {
          slotToOwnerMap.set(roster.roster_id, roster.owner_id);
        }
      }

      // Sync traded picks
      let synced = 0;
      for (const pick of tradedPicks) {
        // Per Sleeper API: roster_id = ORIGINAL owner, owner_id = CURRENT owner
        const originalOwnerId =
          slotToOwnerMap.get(pick.roster_id) || String(pick.roster_id);
        const currentOwnerId =
          slotToOwnerMap.get(pick.owner_id) || String(pick.owner_id);

        await prisma.tradedPick.upsert({
          where: {
            leagueId_season_round_originalOwnerId: {
              leagueId: league.id,
              season: parseInt(pick.season),
              round: pick.round,
              originalOwnerId,
            },
          },
          update: { currentOwnerId },
          create: {
            leagueId: league.id,
            season: parseInt(pick.season),
            round: pick.round,
            originalOwnerId,
            currentOwnerId,
          },
        });
        synced++;
      }

      console.log("Synced", synced, "traded picks for", league.name);
    }

    // Verify
    const sample = await prisma.tradedPick.findFirst({
      where: { season: 2025 },
    });
    console.log("\nSample synced pick:", sample);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
