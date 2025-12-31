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
  // Find players with Brandon or Strange in name
  const players = await prisma.player.findMany({
    where: {
      OR: [
        { fullName: { contains: "Brandon", mode: "insensitive" } },
        { fullName: { contains: "Strange", mode: "insensitive" } },
      ],
    },
    select: { id: true, fullName: true, sleeperId: true },
  });

  console.log("Players found:", players.map((p) => p.fullName).join(", "));

  // Find any keepers for these players
  for (const p of players) {
    const keepers = await prisma.keeper.findMany({
      where: { playerId: p.id },
      orderBy: { season: "desc" },
    });
    if (keepers.length > 0) {
      console.log(`\n${p.fullName} keepers:`);
      keepers.forEach((k) =>
        console.log(
          `  Season ${k.season}: base=R${k.baseCost}, years=${k.yearsKept}, final=R${k.finalCost}, type=${k.type}`
        )
      );
    }
  }

  // Also show all 2025 keepers for reference
  console.log("\n=== All 2025 Keepers ===");
  const allKeepers = await prisma.keeper.findMany({
    where: { season: 2025 },
    include: { player: true },
    orderBy: { player: { fullName: "asc" } },
  });

  for (const k of allKeepers) {
    console.log(
      `${k.player?.fullName}: base=R${k.baseCost}, years=${k.yearsKept}, final=R${k.finalCost}`
    );
  }

  await prisma.$disconnect();
}

main();
