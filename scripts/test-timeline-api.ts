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

function getSeasonFromDate(date: Date): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month < 2) return year - 1;
  return year;
}

async function main() {
  console.log("=== TESTING TIMELINE API LOGIC ===\n");

  // Find Javonte Williams
  const player = await prisma.player.findFirst({
    where: { fullName: { contains: "Javonte Williams" } },
    select: { id: true, sleeperId: true, fullName: true },
  });

  if (!player) {
    console.log("Player not found");
    return;
  }

  console.log(`Found: ${player.fullName}\n`);

  // Get draft picks sorted by season
  const draftPicks = await prisma.draftPick.findMany({
    where: { playerId: player.id },
    include: {
      draft: {
        select: {
          season: true,
          league: { select: { id: true, name: true } },
        },
      },
      roster: { select: { id: true, teamName: true, sleeperId: true } },
    },
    orderBy: { draft: { season: "asc" } },
  });

  console.log("Building timeline with inferred drops:\n");

  type TimelineEvent = {
    season: number;
    event: string;
    teamName: string;
    leagueName: string;
    details?: { round?: number };
  };

  const timeline: TimelineEvent[] = [];

  // Track last draft by league to infer drops
  const lastDraftByLeague: Record<string, { season: number; teamName: string; sleeperId: string | null }> = {};

  for (const pick of draftPicks) {
    const leagueId = pick.draft.league.id;
    const lastDraft = lastDraftByLeague[leagueId];

    // If player was drafted before by a different team, infer they were dropped
    if (lastDraft && lastDraft.teamName !== pick.roster?.teamName) {
      timeline.push({
        season: lastDraft.season,
        event: "DROPPED (inferred)",
        teamName: lastDraft.teamName,
        leagueName: pick.draft.league.name,
      });
    }

    timeline.push({
      season: pick.draft.season,
      event: "DRAFTED",
      teamName: pick.roster?.teamName || "Unknown",
      leagueName: pick.draft.league.name,
      details: { round: pick.round },
    });

    // Track last draft for this league
    lastDraftByLeague[leagueId] = {
      season: pick.draft.season,
      teamName: pick.roster?.teamName || "Unknown",
      sleeperId: pick.roster?.sleeperId || null,
    };
  }

  // Get transaction drops
  const transactionPlayers = await prisma.transactionPlayer.findMany({
    where: { playerId: player.id, toRosterId: null },
    include: {
      transaction: { select: { type: true, createdAt: true } },
    },
  });

  for (const tp of transactionPlayers) {
    const fromRoster = await prisma.roster.findUnique({
      where: { id: tp.fromRosterId! },
      select: { teamName: true, league: { select: { name: true } } },
    });

    timeline.push({
      season: getSeasonFromDate(tp.transaction.createdAt),
      event: "DROPPED (explicit)",
      teamName: fromRoster?.teamName || "Unknown",
      leagueName: fromRoster?.league?.name || "Unknown",
    });
  }

  // Sort by season
  timeline.sort((a, b) => a.season - b.season);

  // Print timeline
  for (const event of timeline) {
    const round = event.details?.round ? ` (R${event.details.round})` : "";
    console.log(`${event.season}: ${event.event} - ${event.teamName}${round}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
