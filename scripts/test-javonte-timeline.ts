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

const prisma = new PrismaClient();

async function main() {
  console.log("=== TESTING JAVONTE WILLIAMS TIMELINE ===\n");

  // Find Javonte Williams
  const player = await prisma.player.findFirst({
    where: { fullName: { contains: "Javonte Williams" } },
    select: { id: true, sleeperId: true, fullName: true },
  });

  if (!player) {
    console.log("Player not found");
    return;
  }

  console.log(`Found: ${player.fullName} (ID: ${player.id})\n`);

  // Get all transaction records for this player
  const transactionPlayers = await prisma.transactionPlayer.findMany({
    where: { playerId: player.id },
    include: {
      transaction: {
        select: { type: true, createdAt: true, leagueId: true },
      },
    },
    orderBy: { transaction: { createdAt: "asc" } },
  });

  console.log("Transaction history:");
  for (const tp of transactionPlayers) {
    const date = tp.transaction.createdAt.toISOString().split("T")[0];
    const hasFrom = tp.fromRosterId ? "from roster" : "";
    const hasTo = tp.toRosterId ? "to roster" : "";
    const isDrop = tp.fromRosterId && !tp.toRosterId;
    console.log(
      `  ${date} - ${tp.transaction.type} - ${isDrop ? "DROP" : hasFrom + " " + hasTo}`
    );
  }

  // Count drops for this player
  const drops = transactionPlayers.filter(tp => tp.fromRosterId && !tp.toRosterId);
  console.log(`\nTotal drops: ${drops.length}`);

  // Get draft picks
  const draftPicks = await prisma.draftPick.findMany({
    where: { playerId: player.id },
    include: {
      draft: { select: { season: true } },
      roster: { select: { teamName: true } },
    },
    orderBy: { draft: { season: "asc" } },
  });

  console.log("\nDraft history:");
  for (const pick of draftPicks) {
    console.log(`  ${pick.draft.season} - Round ${pick.round} - ${pick.roster?.teamName || "Unknown"}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
