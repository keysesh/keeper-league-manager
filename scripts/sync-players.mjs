import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLEEPER_BASE_URL = "https://api.sleeper.app/v1";

async function getAllPlayers() {
  const response = await fetch(`${SLEEPER_BASE_URL}/players/nfl`);
  if (!response.ok) {
    throw new Error(`Failed to fetch players: ${response.status}`);
  }
  return response.json();
}

function mapSleeperPlayer(player) {
  return {
    firstName: player.first_name || null,
    lastName: player.last_name || null,
    fullName: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown',
    position: player.position || null,
    team: player.team || null,
    age: player.age || null,
    yearsExp: player.years_exp || null,
    status: player.status || null,
    injuryStatus: player.injury_status || null,
    searchRank: player.search_rank || null,
    fantasyPositions: player.fantasy_positions || [],
    metadata: player.metadata || null,
  };
}

async function syncAllPlayers() {
  console.log("Starting player sync...");
  const players = await getAllPlayers();
  const playerEntries = Object.entries(players);

  let created = 0;
  let updated = 0;

  // Process in batches of 100 for performance
  const batchSize = 100;
  for (let i = 0; i < playerEntries.length; i += batchSize) {
    const batch = playerEntries.slice(i, i + batchSize);

    await prisma.$transaction(
      batch.map(([playerId, player]) => {
        const data = mapSleeperPlayer(player);
        return prisma.player.upsert({
          where: { sleeperId: playerId },
          update: data,
          create: { sleeperId: playerId, ...data },
        });
      })
    );

    // Log progress every 1000 players
    if ((i + batchSize) % 1000 === 0) {
      console.log(`Processed ${i + batchSize} / ${playerEntries.length} players`);
    }
  }

  console.log(`Player sync complete: ${playerEntries.length} players processed`);
  return { created, updated, total: playerEntries.length };
}

syncAllPlayers()
  .then((result) => {
    console.log("Done:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
