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
  console.log("=== FINDING GLITCH TRANSACTIONS ===\n");
  console.log("Looking for DROP followed by ADD on same/close day...\n");

  // Get all transaction players with their transaction details
  const transactionPlayers = await prisma.transactionPlayer.findMany({
    include: {
      player: { select: { fullName: true, sleeperId: true } },
      transaction: {
        select: {
          createdAt: true,
          type: true,
          league: { select: { name: true } }
        }
      },
    },
    orderBy: { transaction: { createdAt: "asc" } }
  });

  // Get all rosters for name lookup
  const rosters = await prisma.roster.findMany({
    select: { id: true, teamName: true }
  });
  const rosterMap = new Map(rosters.map(r => [r.id, r.teamName || "Unknown"]));

  // Group by player
  const byPlayer = new Map<string, typeof transactionPlayers>();
  for (const t of transactionPlayers) {
    const key = t.playerId;
    if (!byPlayer.has(key)) byPlayer.set(key, []);
    byPlayer.get(key)!.push(t);
  }

  // Find patterns: DROP (toRoster null) followed by ADD within 7 days
  interface GlitchPattern {
    playerName: string;
    dropDate: Date;
    dropFrom: string;
    addDate: Date;
    addTo: string;
    league: string;
    daysBetween: number;
  }

  const glitchPatterns: GlitchPattern[] = [];

  for (const playerTxns of byPlayer.values()) {
    // Sort by date
    const sorted = playerTxns.sort((a, b) =>
      a.transaction.createdAt.getTime() - b.transaction.createdAt.getTime()
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // Check if current is a DROP (toRosterId is null, fromRosterId exists)
      const isDrop = current.toRosterId === null && current.fromRosterId !== null;
      // Check if next is an ADD (toRosterId exists)
      const isAdd = next.toRosterId !== null;

      if (isDrop && isAdd) {
        const daysBetween = Math.abs(
          (next.transaction.createdAt.getTime() - current.transaction.createdAt.getTime())
          / (1000 * 60 * 60 * 24)
        );

        if (daysBetween <= 7) {
          glitchPatterns.push({
            playerName: current.player.fullName,
            dropDate: current.transaction.createdAt,
            dropFrom: rosterMap.get(current.fromRosterId!) || "?",
            addDate: next.transaction.createdAt,
            addTo: rosterMap.get(next.toRosterId!) || "?",
            league: current.transaction.league.name,
            daysBetween: Math.round(daysBetween * 10) / 10,
          });
        }
      }
    }
  }

  console.log("Found " + glitchPatterns.length + " potential glitch patterns:\n");

  // Group by days between
  const sameDayPatterns = glitchPatterns.filter(p => p.daysBetween < 1);
  const closePatterns = glitchPatterns.filter(p => p.daysBetween >= 1);

  console.log("=== SAME DAY (likely glitch fixes) ===");
  for (const p of sameDayPatterns) {
    console.log(p.playerName);
    console.log("  League: " + p.league);
    console.log("  " + p.dropDate.toISOString().split("T")[0] + ": Dropped by " + p.dropFrom);
    console.log("  " + p.addDate.toISOString().split("T")[0] + ": Added by " + p.addTo);
    console.log("  Days between: " + p.daysBetween);
    console.log();
  }

  if (closePatterns.length > 0) {
    console.log("\n=== WITHIN 7 DAYS (may be normal activity) ===");
    for (const p of closePatterns) {
      console.log(p.playerName + ": " + p.dropFrom + " -> " + p.addTo + " (" + p.daysBetween + " days, " + p.league + ")");
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
