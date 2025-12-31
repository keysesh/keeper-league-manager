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
  console.log("=== CHECKING DROP TRANSACTIONS ===\n");

  // Count total transactions by type
  const txCounts = await prisma.transaction.groupBy({
    by: ["type"],
    _count: true,
  });
  console.log("Transaction counts by type:");
  for (const t of txCounts) {
    console.log(`  ${t.type}: ${t._count}`);
  }

  // Find drop transactions (TransactionPlayer where toRosterId is null)
  const dropRecords = await prisma.transactionPlayer.findMany({
    where: { toRosterId: null },
    include: {
      player: { select: { fullName: true, sleeperId: true } },
      transaction: { select: { type: true, createdAt: true } },
    },
    take: 20,
    orderBy: { transaction: { createdAt: "desc" } },
  });

  console.log(`\nFound ${dropRecords.length} drop records (showing up to 20):\n`);
  for (const drop of dropRecords) {
    const playerName = drop.player ? drop.player.fullName : "Unknown";
    const date = drop.transaction.createdAt.toISOString().split("T")[0];
    console.log(`  ${playerName} - ${drop.transaction.type} - ${date}`);
  }

  // Count total drops
  const totalDrops = await prisma.transactionPlayer.count({
    where: { toRosterId: null },
  });
  console.log(`\nTotal drops in database: ${totalDrops}`);

  await prisma.$disconnect();
}

main().catch(console.error);
