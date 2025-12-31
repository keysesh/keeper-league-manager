/**
 * Sync NFLverse Stats
 *
 * Fetches player stats from NFLverse and updates our database.
 * NFLverse provides comprehensive NFL stats in CSV format.
 *
 * Usage: npx ts-node scripts/sync-nflverse-stats.ts [season]
 * Example: npx ts-node scripts/sync-nflverse-stats.ts 2024
 */

import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";

const prisma = new PrismaClient();

// NFLverse data URLs
const NFLVERSE_STATS_URL = (season: number) =>
  `https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_${season}.csv`;

// Sleeper ID mapping URL (to match NFLverse to Sleeper IDs)
const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";

interface NFLVersePlayerStats {
  player_id: string;
  player_name: string;
  player_display_name: string;
  position: string;
  team: string;
  games: number;
  // Passing
  passing_yards: number;
  passing_tds: number;
  interceptions: number;
  // Rushing
  rushing_yards: number;
  rushing_tds: number;
  carries: number;
  // Receiving
  receptions: number;
  receiving_yards: number;
  receiving_tds: number;
  targets: number;
  // Fantasy
  fantasy_points: number;
  fantasy_points_ppr: number;
}

interface SleeperPlayer {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  gsis_id?: string;
  espn_id?: string;
  position: string;
  team: string;
}

async function fetchNFLVerseStats(season: number): Promise<NFLVersePlayerStats[]> {
  console.log(`Fetching NFLverse stats for ${season}...`);

  const response = await fetch(NFLVERSE_STATS_URL(season));
  if (!response.ok) {
    throw new Error(`Failed to fetch NFLverse stats: ${response.statusText}`);
  }

  const csvText = await response.text();
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];

  // Aggregate stats by player (NFLverse has per-week data)
  const playerStats = new Map<string, NFLVersePlayerStats>();

  for (const record of records) {
    const playerId = record.player_id;
    if (!playerId) continue;

    const existing = playerStats.get(playerId) || {
      player_id: playerId,
      player_name: record.player_name || "",
      player_display_name: record.player_display_name || "",
      position: record.position || "",
      team: record.recent_team || "",
      games: 0,
      passing_yards: 0,
      passing_tds: 0,
      interceptions: 0,
      rushing_yards: 0,
      rushing_tds: 0,
      carries: 0,
      receptions: 0,
      receiving_yards: 0,
      receiving_tds: 0,
      targets: 0,
      fantasy_points: 0,
      fantasy_points_ppr: 0,
    };

    // Aggregate stats
    existing.games += 1;
    existing.passing_yards += parseFloat(record.passing_yards) || 0;
    existing.passing_tds += parseFloat(record.passing_tds) || 0;
    existing.interceptions += parseFloat(record.interceptions) || 0;
    existing.rushing_yards += parseFloat(record.rushing_yards) || 0;
    existing.rushing_tds += parseFloat(record.rushing_tds) || 0;
    existing.carries += parseFloat(record.carries) || 0;
    existing.receptions += parseFloat(record.receptions) || 0;
    existing.receiving_yards += parseFloat(record.receiving_yards) || 0;
    existing.receiving_tds += parseFloat(record.receiving_tds) || 0;
    existing.targets += parseFloat(record.targets) || 0;
    existing.fantasy_points += parseFloat(record.fantasy_points) || 0;
    existing.fantasy_points_ppr += parseFloat(record.fantasy_points_ppr) || 0;
    existing.team = record.recent_team || existing.team;

    playerStats.set(playerId, existing);
  }

  console.log(`Found ${playerStats.size} players in NFLverse data`);
  return Array.from(playerStats.values());
}

async function fetchSleeperPlayers(): Promise<Map<string, SleeperPlayer>> {
  console.log("Fetching Sleeper player mappings...");

  const response = await fetch(SLEEPER_PLAYERS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Sleeper players: ${response.statusText}`);
  }

  const players: Record<string, SleeperPlayer> = await response.json();
  const playerMap = new Map<string, SleeperPlayer>();

  // Build lookup by gsis_id (NFLverse uses gsis_id)
  for (const [sleeperId, player] of Object.entries(players)) {
    if (player.gsis_id) {
      playerMap.set(player.gsis_id, { ...player, player_id: sleeperId });
    }
  }

  console.log(`Loaded ${playerMap.size} Sleeper players with GSIS IDs`);
  return playerMap;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/jr|sr|ii|iii|iv/g, "");
}

async function syncStats(season: number) {
  console.log(`\n=== Syncing NFLverse Stats for ${season} ===\n`);

  // Fetch data
  const nflverseStats = await fetchNFLVerseStats(season);
  const sleeperPlayers = await fetchSleeperPlayers();

  // Get all players from our database
  const dbPlayers = await prisma.player.findMany({
    select: {
      id: true,
      sleeperId: true,
      fullName: true,
      position: true,
    },
  });

  console.log(`Found ${dbPlayers.length} players in database`);

  // Build name lookup for fallback matching
  const dbPlayersByName = new Map<string, typeof dbPlayers[0]>();
  for (const player of dbPlayers) {
    dbPlayersByName.set(normalizeName(player.fullName), player);
  }

  let updated = 0;
  let notFound = 0;
  let seasonStatsCreated = 0;

  for (const stats of nflverseStats) {
    // Try to find matching Sleeper player by GSIS ID
    const sleeperPlayer = sleeperPlayers.get(stats.player_id);
    let dbPlayer: typeof dbPlayers[0] | undefined;

    if (sleeperPlayer) {
      dbPlayer = dbPlayers.find((p) => p.sleeperId === sleeperPlayer.player_id);
    }

    // Fallback: match by name
    if (!dbPlayer) {
      dbPlayer = dbPlayersByName.get(normalizeName(stats.player_display_name));
    }

    if (!dbPlayer) {
      notFound++;
      continue;
    }

    // Calculate fantasy points
    const pprPoints = stats.fantasy_points_ppr;
    const halfPprPoints = stats.fantasy_points + stats.receptions * 0.5;
    const ppg = stats.games > 0 ? pprPoints / stats.games : 0;

    // Update player with current stats
    await prisma.player.update({
      where: { id: dbPlayer.id },
      data: {
        fantasyPointsPpr: Math.round(pprPoints * 10) / 10,
        fantasyPointsHalfPpr: Math.round(halfPprPoints * 10) / 10,
        gamesPlayed: stats.games,
        pointsPerGame: Math.round(ppg * 10) / 10,
        statsUpdatedAt: new Date(),
      },
    });

    // Upsert season stats
    await prisma.playerSeasonStats.upsert({
      where: {
        playerId_season: {
          playerId: dbPlayer.id,
          season,
        },
      },
      create: {
        playerId: dbPlayer.id,
        season,
        gamesPlayed: stats.games,
        fantasyPointsPpr: pprPoints,
        fantasyPointsHalfPpr: halfPprPoints,
        fantasyPointsStd: stats.fantasy_points,
        passingYards: Math.round(stats.passing_yards),
        passingTds: Math.round(stats.passing_tds),
        interceptions: Math.round(stats.interceptions),
        rushingYards: Math.round(stats.rushing_yards),
        rushingTds: Math.round(stats.rushing_tds),
        carries: Math.round(stats.carries),
        receptions: Math.round(stats.receptions),
        receivingYards: Math.round(stats.receiving_yards),
        receivingTds: Math.round(stats.receiving_tds),
        targets: Math.round(stats.targets),
      },
      update: {
        gamesPlayed: stats.games,
        fantasyPointsPpr: pprPoints,
        fantasyPointsHalfPpr: halfPprPoints,
        fantasyPointsStd: stats.fantasy_points,
        passingYards: Math.round(stats.passing_yards),
        passingTds: Math.round(stats.passing_tds),
        interceptions: Math.round(stats.interceptions),
        rushingYards: Math.round(stats.rushing_yards),
        rushingTds: Math.round(stats.rushing_tds),
        carries: Math.round(stats.carries),
        receptions: Math.round(stats.receptions),
        receivingYards: Math.round(stats.receiving_yards),
        receivingTds: Math.round(stats.receiving_tds),
        targets: Math.round(stats.targets),
      },
    });

    updated++;
    seasonStatsCreated++;
  }

  console.log(`\n=== Sync Complete ===`);
  console.log(`Updated: ${updated} players`);
  console.log(`Season stats: ${seasonStatsCreated} records`);
  console.log(`Not found in DB: ${notFound} players`);
}

// Main
const season = parseInt(process.argv[2]) || new Date().getFullYear() - 1;

syncStats(season)
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error syncing stats:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
