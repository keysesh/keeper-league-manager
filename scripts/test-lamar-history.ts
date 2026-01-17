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

function getSeasonFromDate(date: Date): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month < 2) return year - 1;
  return year;
}

interface TimelineEvent {
  season: number;
  date?: string;
  event: string;
  teamName: string;
  leagueName: string;
  leagueId: string;
  details?: { round?: number };
}

function filterGlitchTransactions(timeline: TimelineEvent[]): TimelineEvent[] {
  const indicesToRemove = new Set<number>();

  for (let i = 0; i < timeline.length; i++) {
    const current = timeline[i];
    if (current.event !== "DROPPED") continue;
    if (!current.date) continue;

    const dropDate = new Date(current.date).getTime();

    for (let j = i + 1; j < timeline.length; j++) {
      const next = timeline[j];
      if (next.leagueId !== current.leagueId) continue;
      if (next.event !== "DRAFTED") continue;

      if (next.date) {
        const draftDate = new Date(next.date).getTime();
        const daysDiff = Math.abs(draftDate - dropDate) / (1000 * 60 * 60 * 24);

        if (daysDiff <= 1) {
          console.log("FILTERING GLITCH: " + current.teamName + " dropped -> " + next.teamName + " drafted (" + daysDiff.toFixed(2) + " days)");
          indicesToRemove.add(i);
          indicesToRemove.add(j);
          break;
        }
      }

      if (j - i > 3) break;
    }
  }

  return timeline.filter((_, index) => !indicesToRemove.has(index));
}

async function main() {
  console.log("=== TESTING LAMAR JACKSON HISTORY ===\n");

  // Find Lamar Jackson
  const player = await prisma.player.findFirst({
    where: { fullName: { contains: "Lamar Jackson" } },
  });

  if (!player) {
    console.log("Player not found");
    return;
  }

  console.log("Player: " + player.fullName + " (ID: " + player.id + ", Sleeper: " + player.sleeperId + ")\n");

  // Get draft picks
  const draftPicks = await prisma.draftPick.findMany({
    where: { playerId: player.id },
    include: {
      draft: { select: { season: true, league: { select: { id: true, name: true } } } },
      roster: { select: { teamName: true, sleeperId: true } },
    },
    orderBy: { draft: { season: "asc" } },
  });

  // Get keepers
  const keepers = await prisma.keeper.findMany({
    where: { playerId: player.id },
    include: {
      roster: { select: { teamName: true, league: { select: { id: true, name: true } } } },
    },
  });

  // Get transactions
  const transactionPlayers = await prisma.transactionPlayer.findMany({
    where: { playerId: player.id },
    include: {
      transaction: { select: { type: true, createdAt: true, leagueId: true } },
    },
  });

  const rosterIds = new Set<string>();
  for (const tp of transactionPlayers) {
    if (tp.fromRosterId) rosterIds.add(tp.fromRosterId);
    if (tp.toRosterId) rosterIds.add(tp.toRosterId);
  }

  const rosters = await prisma.roster.findMany({
    where: { id: { in: [...rosterIds] } },
    select: { id: true, teamName: true, league: { select: { id: true, name: true } } },
  });
  const rosterMap = new Map(rosters.map(r => [r.id, r]));

  // Build timeline
  const timeline: TimelineEvent[] = [];

  for (const pick of draftPicks) {
    timeline.push({
      season: pick.draft.season,
      event: "DRAFTED",
      teamName: pick.roster?.teamName || "Unknown",
      leagueName: pick.draft.league.name,
      leagueId: pick.draft.league.id,
      details: { round: pick.round },
    });
  }

  for (const keeper of keepers) {
    timeline.push({
      season: keeper.season,
      event: keeper.type === "FRANCHISE" ? "KEPT_FRANCHISE" : "KEPT_REGULAR",
      teamName: keeper.roster.teamName || "Unknown",
      leagueName: keeper.roster.league.name,
      leagueId: keeper.roster.league.id,
      details: { round: keeper.finalCost || undefined },
    });
  }

  for (const tp of transactionPlayers) {
    const fromRoster = tp.fromRosterId ? rosterMap.get(tp.fromRosterId) : null;
    const toRoster = tp.toRosterId ? rosterMap.get(tp.toRosterId) : null;
    const leagueId = toRoster?.league?.id || fromRoster?.league?.id || "";
    const leagueName = toRoster?.league?.name || fromRoster?.league?.name || "Unknown";

    if (fromRoster && !toRoster) {
      timeline.push({
        season: getSeasonFromDate(tp.transaction.createdAt),
        date: tp.transaction.createdAt.toISOString(),
        event: "DROPPED",
        teamName: fromRoster.teamName || "Unknown",
        leagueName,
        leagueId,
      });
    } else if (toRoster && tp.transaction.type === "WAIVER") {
      timeline.push({
        season: getSeasonFromDate(tp.transaction.createdAt),
        date: tp.transaction.createdAt.toISOString(),
        event: "WAIVER",
        teamName: toRoster.teamName || "Unknown",
        leagueName,
        leagueId,
      });
    } else if (toRoster && tp.transaction.type === "FREE_AGENT") {
      timeline.push({
        season: getSeasonFromDate(tp.transaction.createdAt),
        date: tp.transaction.createdAt.toISOString(),
        event: "FREE_AGENT",
        teamName: toRoster.teamName || "Unknown",
        leagueName,
        leagueId,
      });
    }
  }

  // Sort
  timeline.sort((a, b) => {
    if (a.date && b.date) {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (diff !== 0) return diff;
    }
    return a.season - b.season;
  });

  console.log("=== BEFORE FILTER ===");
  for (const e of timeline) {
    const dateStr = e.date ? new Date(e.date).toISOString().split("T")[0] : "";
    console.log(e.season + " " + e.event.padEnd(14) + " " + e.teamName.padEnd(25) + " " + dateStr + " [" + e.leagueName + "]");
  }

  const filtered = filterGlitchTransactions(timeline);

  console.log("\n=== AFTER FILTER ===");
  for (const e of filtered) {
    const dateStr = e.date ? new Date(e.date).toISOString().split("T")[0] : "";
    console.log(e.season + " " + e.event.padEnd(14) + " " + e.teamName.padEnd(25) + " " + dateStr + " [" + e.leagueName + "]");
  }

  console.log("\nRemoved " + (timeline.length - filtered.length) + " glitch events");

  await prisma.$disconnect();
}

main().catch(console.error);
