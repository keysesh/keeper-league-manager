import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

// Load .env.local for production DATABASE_URL
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  if (envConfig.DATABASE_URL) {
    process.env.DATABASE_URL = envConfig.DATABASE_URL;
  }
}

const prisma = new PrismaClient();

interface SleeperTransaction {
  transaction_id: string;
  type: string;
  status: string;
  leg: number;
  created: number;
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
}

async function fetchTransactions(leagueId: string, week: number): Promise<SleeperTransaction[]> {
  const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${week}`);
  if (!response.ok) {
    return [];
  }
  return response.json();
}

async function main() {
  console.log("=== ANALYZING SLEEPER DROPS ===\n");

  // Get a league to analyze
  const league = await prisma.league.findFirst({
    select: { sleeperId: true, name: true, season: true },
  });

  if (!league) {
    console.log("No league found in database");
    return;
  }

  console.log(`Analyzing league: ${league.name} (Season ${league.season})\n`);

  let totalTransactions = 0;
  let transactionsWithDrops = 0;
  let standaloneDrops = 0;
  const dropExamples: Array<{ week: number; type: string; droppedPlayerId: string; addedPlayerId?: string }> = [];

  // Fetch transactions for all weeks
  for (let week = 0; week <= 18; week++) {
    const transactions = await fetchTransactions(league.sleeperId, week);

    for (const tx of transactions) {
      totalTransactions++;

      if (tx.drops && Object.keys(tx.drops).length > 0) {
        transactionsWithDrops++;

        for (const [playerId, rosterId] of Object.entries(tx.drops)) {
          // Check if this is a standalone drop (not in adds)
          const isStandalone = !tx.adds || !(playerId in tx.adds);

          if (isStandalone) {
            standaloneDrops++;
            if (dropExamples.length < 10) {
              dropExamples.push({
                week,
                type: tx.type,
                droppedPlayerId: playerId,
              });
            }
          } else if (dropExamples.length < 5) {
            // Also capture some non-standalone drops for comparison
            const addedPlayerIds = tx.adds ? Object.keys(tx.adds) : [];
            dropExamples.push({
              week,
              type: tx.type,
              droppedPlayerId: playerId,
              addedPlayerId: addedPlayerIds[0],
            });
          }
        }
      }
    }
  }

  console.log(`Total transactions: ${totalTransactions}`);
  console.log(`Transactions with drops: ${transactionsWithDrops}`);
  console.log(`Standalone drops (to waivers/FA): ${standaloneDrops}`);

  console.log("\nDrop examples:");
  for (const ex of dropExamples) {
    if (ex.addedPlayerId) {
      console.log(`  Week ${ex.week} - ${ex.type}: Dropped ${ex.droppedPlayerId}, Added ${ex.addedPlayerId}`);
    } else {
      console.log(`  Week ${ex.week} - ${ex.type}: Dropped ${ex.droppedPlayerId} (standalone)`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
