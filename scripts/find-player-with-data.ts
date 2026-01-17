import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  if (envConfig.DATABASE_URL) {
    process.env.DATABASE_URL = envConfig.DATABASE_URL;
  }
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Count totals
  const totalTxns = await prisma.transactionPlayer.count();
  const totalDrops = await prisma.transactionPlayer.count({ where: { toRosterId: null } });
  const totalDrafts = await prisma.draftPick.count();
  const totalKeepers = await prisma.keeper.count();

  console.log("Total transaction players:", totalTxns);
  console.log("Total drops (toRosterId null):", totalDrops);
  console.log("Total draft picks:", totalDrafts);
  console.log("Total keepers:", totalKeepers);

  // Find a player with transactions
  const playerWithTxns = await prisma.transactionPlayer.findFirst({
    where: { toRosterId: null }, // A drop
    include: { player: true },
    orderBy: { transaction: { createdAt: "desc" } },
  });

  if (playerWithTxns) {
    console.log("\nPlayer with drop transaction:", playerWithTxns.player.fullName, "(sleeper:", playerWithTxns.player.sleeperId + ")");

    // Get all their events
    const allTxns = await prisma.transactionPlayer.count({ where: { playerId: playerWithTxns.playerId } });
    const allDrafts = await prisma.draftPick.count({ where: { playerId: playerWithTxns.playerId } });
    console.log("This player has", allTxns, "transactions and", allDrafts, "draft picks");
  }

  // Find players with both drops and drafts
  const playersWithDrops = await prisma.transactionPlayer.findMany({
    where: { toRosterId: null },
    select: { playerId: true },
    distinct: ["playerId"],
    take: 100,
  });

  console.log("\nPlayers with drops:", playersWithDrops.length);

  for (const p of playersWithDrops.slice(0, 5)) {
    const drafts = await prisma.draftPick.count({ where: { playerId: p.playerId } });
    if (drafts > 0) {
      const player = await prisma.player.findUnique({ where: { id: p.playerId } });
      const txnCount = await prisma.transactionPlayer.count({ where: { playerId: p.playerId } });
      console.log("  " + player?.fullName + " has " + drafts + " drafts and " + txnCount + " transactions");
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
