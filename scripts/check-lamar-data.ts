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
  // Find Lamar by name
  const player = await prisma.player.findFirst({
    where: { fullName: { contains: "Lamar Jackson" } },
  });
  console.log("Player by name:", player?.id, player?.sleeperId, player?.fullName);

  if (player) {
    const drafts = await prisma.draftPick.count({ where: { playerId: player.id } });
    const keepers = await prisma.keeper.count({ where: { playerId: player.id } });
    const txns = await prisma.transactionPlayer.count({ where: { playerId: player.id } });
    console.log("Draft picks:", drafts);
    console.log("Keepers:", keepers);
    console.log("Transactions:", txns);

    // Show some transactions
    if (txns > 0) {
      const txnPlayers = await prisma.transactionPlayer.findMany({
        where: { playerId: player.id },
        include: { transaction: true },
        take: 10,
      });
      console.log("\nSample transactions:");
      for (const tp of txnPlayers) {
        console.log("  " + tp.transaction.createdAt.toISOString().split("T")[0] + " " + tp.transaction.type + " from:" + tp.fromRosterId + " to:" + tp.toRosterId);
      }
    }
  }

  // Also try sleeper ID 3321 (might be different)
  const player2 = await prisma.player.findUnique({ where: { sleeperId: "3321" } });
  if (player2 && player2.id !== player?.id) {
    console.log("\nPlayer by sleeper 3321:", player2.fullName);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
