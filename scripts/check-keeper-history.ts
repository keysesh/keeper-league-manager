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

async function main() {
  const playerNames = ["Calvin Ridley", "George Pickens"];

  for (const name of playerNames) {
    console.log(`\n=== ${name} ===\n`);

    // Find player
    const player = await prisma.player.findFirst({
      where: { fullName: name },
    });

    if (!player) {
      console.log("Player not found in database");
      continue;
    }

    console.log(`Player ID: ${player.id}`);
    console.log(`Sleeper ID: ${player.sleeperId}`);

    // Get all keeper records
    const keepers = await prisma.keeper.findMany({
      where: { playerId: player.id },
      include: { roster: { include: { league: true } } },
      orderBy: { season: "asc" },
    });

    console.log(`\nKeeper Records (${keepers.length}):`);
    for (const k of keepers) {
      console.log(
        `  Season ${k.season}: yearsKept=${k.yearsKept}, baseCost=R${k.baseCost}, finalCost=R${k.finalCost}, type=${k.type}, roster=${k.roster.teamName || k.roster.sleeperId}`
      );
    }

    // Get all draft picks with isKeeper flag
    const draftPicks = await prisma.draftPick.findMany({
      where: { playerId: player.id },
      include: { draft: true, roster: true },
      orderBy: { draft: { season: "asc" } },
    });

    console.log(`\nDraft Picks (${draftPicks.length}):`);
    for (const dp of draftPicks) {
      console.log(
        `  Season ${dp.draft.season}: Round ${dp.round}, isKeeper=${dp.isKeeper}, roster=${dp.roster.teamName || dp.roster.sleeperId}`
      );
    }

    // Get transaction history
    const transactions = await prisma.transactionPlayer.findMany({
      where: { playerId: player.id },
      include: { transaction: true },
      orderBy: { transaction: { createdAt: "asc" } },
    });

    console.log(`\nTransactions (${transactions.length}):`);
    for (const tx of transactions) {
      const date = tx.transaction.createdAt.toISOString().split("T")[0];
      console.log(
        `  ${date}: ${tx.transaction.type}, from=${tx.fromRosterId?.slice(0, 8) || "N/A"} to=${tx.toRosterId?.slice(0, 8) || "N/A"}`
      );
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
