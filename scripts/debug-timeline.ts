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
  console.log("=== DEBUG TIMELINE ===\n");

  const player = await prisma.player.findFirst({
    where: { fullName: { contains: "Javonte Williams" } },
    select: { id: true, fullName: true },
  });

  if (!player) {
    console.log("Player not found");
    return;
  }

  const draftPicks = await prisma.draftPick.findMany({
    where: { playerId: player.id },
    include: {
      draft: {
        select: {
          season: true,
          league: { select: { id: true, name: true } },
        },
      },
      roster: { select: { teamName: true } },
    },
    orderBy: { draft: { season: "asc" } },
  });

  console.log("Draft picks with league info:\n");
  for (const pick of draftPicks) {
    console.log(`${pick.draft.season}: ${pick.roster?.teamName} - R${pick.round}`);
    console.log(`  League: ${pick.draft.league.name} (${pick.draft.league.id})`);
    console.log();
  }

  // Group by league NAME (not ID) since dynasty leagues have different IDs each season
  const byLeagueName = new Map<string, typeof draftPicks>();
  for (const pick of draftPicks) {
    const leagueName = pick.draft.league.name;
    if (!byLeagueName.has(leagueName)) byLeagueName.set(leagueName, []);
    byLeagueName.get(leagueName)!.push(pick);
  }

  console.log("=== Inferred Drops by League (using NAME) ===\n");
  for (const [leagueName, picks] of byLeagueName) {
    console.log(`League: ${leagueName}`);
    let lastTeam: string | null = null;
    let lastSeason: number | null = null;

    for (const pick of picks) {
      const team = pick.roster?.teamName || "Unknown";
      if (lastTeam && lastTeam !== team) {
        console.log(`  -> DROPPED by ${lastTeam} after ${lastSeason}`);
      }
      console.log(`  ${pick.draft.season}: Drafted by ${team} (R${pick.round})`);
      lastTeam = team;
      lastSeason = pick.draft.season;
    }
    console.log();
  }

  await prisma.$disconnect();
}

main().catch(console.error);
