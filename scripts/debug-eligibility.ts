import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get a roster with players
  const roster = await prisma.roster.findFirst({
    where: { league: { season: 2025 } },
    include: {
      rosterPlayers: {
        include: { player: true },
        take: 5,
      },
    },
  });

  if (!roster) {
    console.log("No roster found");
    return;
  }

  console.log("Roster:", roster.teamName);
  console.log("League ID:", roster.leagueId);
  console.log("Roster ID:", roster.id);

  const playerIds = roster.rosterPlayers.map((rp) => rp.playerId);

  // Check draft picks for these players
  const draftPicks = await prisma.draftPick.findMany({
    where: { playerId: { in: playerIds } },
    include: { draft: true },
  });

  console.log("\nDraft picks found:", draftPicks.length);
  draftPicks.forEach((dp) => {
    const player = roster.rosterPlayers.find((rp) => rp.playerId === dp.playerId);
    console.log(
      "  -",
      player?.player.fullName,
      "| Draft:",
      dp.draft.season,
      "R" + dp.round,
      "| Pick RosterId:",
      dp.rosterId,
      "| Current RosterId:",
      roster.id
    );
  });

  // Check if rosterId in draft picks matches roster.id
  console.log("\nRoster ID matching check:");
  for (const dp of draftPicks) {
    const player = roster.rosterPlayers.find((rp) => rp.playerId === dp.playerId);
    const matches = dp.rosterId === roster.id;
    console.log(
      "  -",
      player?.player.fullName,
      "| Draft rosterId:",
      dp.rosterId?.substring(0, 10) + "...",
      "| Roster id:",
      roster.id.substring(0, 10) + "...",
      "| Match:",
      matches
    );
  }

  // Check transactions
  const transactions = await prisma.transactionPlayer.findMany({
    where: { playerId: { in: playerIds } },
    include: { transaction: true },
    take: 10,
  });

  console.log("\nTransactions found:", transactions.length);
  transactions.forEach((tx) => {
    const player = roster.rosterPlayers.find((rp) => rp.playerId === tx.playerId);
    console.log(
      "  -",
      player?.player.fullName,
      "|",
      tx.transaction.type,
      "| From:",
      tx.fromRosterId?.substring(0, 10) || "null",
      "-> To:",
      tx.toRosterId?.substring(0, 10) || "null"
    );
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
