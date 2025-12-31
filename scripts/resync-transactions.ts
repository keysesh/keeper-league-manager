import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load .env.local BEFORE importing prisma
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  if (envConfig.DATABASE_URL) {
    process.env.DATABASE_URL = envConfig.DATABASE_URL;
  }
}

import { PrismaClient } from "@prisma/client";
import { syncTransactions } from "../src/lib/sleeper/sync";

const prisma = new PrismaClient();

async function main() {
  console.log("=== RE-SYNCING TRANSACTIONS ===\n");

  // Get all leagues
  const leagues = await prisma.league.findMany({
    select: { id: true, name: true, sleeperId: true, season: true },
    orderBy: { season: "desc" },
  });

  console.log(`Found ${leagues.length} leagues to sync\n`);

  for (const league of leagues) {
    console.log(`Syncing ${league.name} (${league.season})...`);
    try {
      const count = await syncTransactions(league.id);
      console.log(`  ✓ Synced ${count} transactions`);
    } catch (err) {
      console.log(`  ✗ Error: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Check drops after sync
  console.log("\n=== CHECKING DROPS ===\n");

  const dropCount = await prisma.transactionPlayer.count({
    where: { toRosterId: null },
  });
  console.log(`Total drops in database: ${dropCount}`);

  // Show some examples
  const drops = await prisma.transactionPlayer.findMany({
    where: { toRosterId: null },
    include: {
      player: { select: { fullName: true } },
      transaction: { select: { type: true, createdAt: true } },
    },
    take: 10,
    orderBy: { transaction: { createdAt: "desc" } },
  });

  if (drops.length > 0) {
    console.log("\nRecent drops:");
    for (const drop of drops) {
      const playerName = drop.player ? drop.player.fullName : "Unknown";
      const date = drop.transaction.createdAt.toISOString().split("T")[0];
      console.log(`  ${playerName} - ${drop.transaction.type} - ${date}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
