import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  if (envConfig.DATABASE_URL) {
    process.env.DATABASE_URL = envConfig.DATABASE_URL;
  }
}

const prisma = new PrismaClient();

async function main() {
  // Find Jackson Off My DK's roster to get the league
  const roster = await prisma.roster.findFirst({
    where: { teamName: { contains: "Jackson Off My DK" } },
    include: { league: true },
  });

  if (!roster) {
    console.log("Roster not found");
    return;
  }

  console.log("=== Current League ===");
  console.log(`League ID: ${roster.league.id}`);
  console.log(`Sleeper ID: ${roster.league.sleeperId}`);
  console.log(`Season: ${roster.league.season}`);
  console.log(`Previous League ID: ${roster.league.previousLeagueId}`);

  // Follow the chain
  let currentLeagueId = roster.league.previousLeagueId;
  let depth = 1;
  const allLeagueIds = [roster.league.id];

  while (currentLeagueId && depth < 10) {
    const prevLeague = await prisma.league.findUnique({
      where: { id: currentLeagueId },
    });
    if (!prevLeague) break;

    console.log(`\n=== Previous League (${depth}) ===`);
    console.log(`League ID: ${prevLeague.id}`);
    console.log(`Sleeper ID: ${prevLeague.sleeperId}`);
    console.log(`Season: ${prevLeague.season}`);
    console.log(`Previous League ID: ${prevLeague.previousLeagueId}`);

    allLeagueIds.push(prevLeague.id);
    currentLeagueId = prevLeague.previousLeagueId;
    depth++;
  }

  console.log("\n=== All League IDs in chain ===");
  console.log(allLeagueIds);

  // Check which leagues have George Pickens draft picks
  const player = await prisma.player.findFirst({
    where: { fullName: "George Pickens" },
  });

  if (player) {
    const picks = await prisma.draftPick.findMany({
      where: { playerId: player.id },
      include: { draft: { include: { league: true } } },
    });

    console.log("\n=== George Pickens Draft Picks by League ===");
    for (const pick of picks) {
      console.log(
        `Season ${pick.draft.season}: LeagueID=${pick.draft.leagueId.slice(0, 12)}..., isKeeper=${pick.isKeeper}`
      );
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
