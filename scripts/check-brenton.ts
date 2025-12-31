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
  // Find Brenton Strange
  const player = await prisma.player.findFirst({
    where: { fullName: { contains: "Brenton Strange", mode: "insensitive" } },
  });

  if (!player) {
    console.log("Player not found");
    await prisma.$disconnect();
    return;
  }

  console.log("Player:", player.fullName, "(Sleeper ID:", player.sleeperId, ")");

  // Check draft history
  console.log("\n=== Draft History ===");
  const draftPicks = await prisma.draftPick.findMany({
    where: { playerId: player.id },
    include: { draft: true, roster: true },
    orderBy: { draft: { season: "asc" } },
  });

  if (draftPicks.length === 0) {
    console.log("No draft picks found - player was never drafted");
  } else {
    for (const dp of draftPicks) {
      console.log(`  Season ${dp.draft.season}: Round ${dp.round}, Pick ${dp.pickNumber}`);
    }
  }

  // Check transaction history
  console.log("\n=== Transaction History ===");
  const transactions = await prisma.transactionPlayer.findMany({
    where: { playerId: player.id },
    include: { transaction: true },
    orderBy: { transaction: { createdAt: "asc" } },
  });

  for (const tx of transactions) {
    const date = tx.transaction.createdAt.toISOString().split("T")[0];
    console.log(`  ${date}: ${tx.transaction.type} (from: ${tx.fromRosterId || "none"} -> to: ${tx.toRosterId || "none"})`);
  }

  // Check keeper history
  console.log("\n=== Keeper History ===");
  const keepers = await prisma.keeper.findMany({
    where: { playerId: player.id },
    orderBy: { season: "asc" },
  });

  if (keepers.length === 0) {
    console.log("No keeper records found");
  } else {
    for (const k of keepers) {
      console.log(`  Season ${k.season}: base=R${k.baseCost}, years=${k.yearsKept}, final=R${k.finalCost}`);
    }
  }

  await prisma.$disconnect();
}

main();
