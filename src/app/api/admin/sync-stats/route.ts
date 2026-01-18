import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { parse } from "csv-parse/sync";
import {
  checkRateLimit,
  createRateLimitResponse,
  addRateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/rate-limit";

/**
 * POST /api/admin/sync-stats
 * Sync NFLverse stats for a given season
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Apply rate limiting
    const rateLimit = await checkRateLimit(session.user.id, RATE_LIMITS.admin);
    if (!rateLimit.success) {
      return createRateLimitResponse(
        rateLimit.remaining,
        rateLimit.reset,
        rateLimit.limit
      );
    }

    const body = await request.json();
    const season = body.season || new Date().getFullYear() - 1;

    logger.info(`Syncing NFLverse stats for ${season}...`);

    // Fetch NFLverse stats
    const statsUrl = `https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_${season}.csv`;
    const statsResponse = await fetch(statsUrl);

    if (!statsResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch NFLverse stats: ${statsResponse.statusText}` },
        { status: 500 }
      );
    }

    const csvText = await statsResponse.text();
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
    }) as Record<string, string>[];

    // Aggregate stats by player
    const playerStats = new Map<
      string,
      {
        player_id: string;
        player_display_name: string;
        position: string;
        team: string;
        games: number;
        passing_yards: number;
        passing_tds: number;
        interceptions: number;
        rushing_yards: number;
        rushing_tds: number;
        carries: number;
        receptions: number;
        receiving_yards: number;
        receiving_tds: number;
        targets: number;
        fantasy_points: number;
        fantasy_points_ppr: number;
      }
    >();

    for (const record of records) {
      const playerId = record.player_id;
      if (!playerId) continue;

      const existing = playerStats.get(playerId) || {
        player_id: playerId,
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

    // Fetch Sleeper player mappings
    const sleeperResponse = await fetch("https://api.sleeper.app/v1/players/nfl");
    const sleeperPlayers: Record<
      string,
      { player_id: string; full_name: string; gsis_id?: string }
    > = await sleeperResponse.json();

    // Build GSIS ID to Sleeper ID map
    const gsisToSleeper = new Map<string, string>();
    for (const [sleeperId, player] of Object.entries(sleeperPlayers)) {
      if (player.gsis_id) {
        gsisToSleeper.set(player.gsis_id, sleeperId);
      }
    }

    // Get all players from our database
    const dbPlayers = await prisma.player.findMany({
      select: { id: true, sleeperId: true, fullName: true },
    });

    const dbPlayersBySleeperId = new Map(dbPlayers.map((p) => [p.sleeperId, p]));
    const normalizeName = (name: string) =>
      name.toLowerCase().replace(/[^a-z]/g, "").replace(/jr|sr|ii|iii|iv/g, "");
    const dbPlayersByName = new Map(dbPlayers.map((p) => [normalizeName(p.fullName), p]));

    let updated = 0;

    for (const stats of playerStats.values()) {
      const sleeperId = gsisToSleeper.get(stats.player_id);
      let dbPlayer = sleeperId ? dbPlayersBySleeperId.get(sleeperId) : undefined;

      if (!dbPlayer) {
        dbPlayer = dbPlayersByName.get(normalizeName(stats.player_display_name));
      }

      if (!dbPlayer) continue;

      const pprPoints = stats.fantasy_points_ppr;
      const halfPprPoints = stats.fantasy_points + stats.receptions * 0.5;
      const ppg = stats.games > 0 ? pprPoints / stats.games : 0;

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

      await prisma.playerSeasonStats.upsert({
        where: { playerId_season: { playerId: dbPlayer.id, season } },
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
    }

    // Also sync projections for upcoming season
    // Try current year first (upcoming season), fall back to previous year (pre-season projections)
    // Example: In Jan 2026, try 2026 projections first, then 2025 if not available
    const currentYear = new Date().getFullYear();
    const projectionYearsToTry = [currentYear, currentYear - 1];
    let projectionsUpdated = 0;
    let projectionSeasonUsed = 0;

    for (const projYear of projectionYearsToTry) {
      try {
        logger.info(`Trying projections for ${projYear}...`);
        const projectionsUrl = `https://github.com/nflverse/nflverse-data/releases/download/projections/projections_${projYear}.csv`;
        const projectionsResponse = await fetch(projectionsUrl);

        if (!projectionsResponse.ok) {
          logger.info(`Projections not available for ${projYear}: ${projectionsResponse.status}`);
          continue; // Try next year
        }

        const projCsvText = await projectionsResponse.text();
        const projRecords = parse(projCsvText, {
          columns: true,
          skip_empty_lines: true,
        }) as Record<string, string>[];

        // Aggregate projections by player (sum across weeks if weekly projections)
        const playerProjections = new Map<string, { pprPoints: number; gsisId: string }>();

        for (const record of projRecords) {
          const gsisId = record.player_id || record.gsis_id;
          if (!gsisId) continue;

          // Get PPR projection (or calculate from components)
          const pprPoints = parseFloat(record.fantasy_points_ppr) ||
                          parseFloat(record.fpts_ppr) ||
                          parseFloat(record.fantasy_points) || 0;

          const existing = playerProjections.get(gsisId);
          if (existing) {
            existing.pprPoints += pprPoints;
          } else {
            playerProjections.set(gsisId, { pprPoints, gsisId });
          }
        }

        // Update players with projections
        for (const [gsisId, proj] of playerProjections) {
          const sleeperId = gsisToSleeper.get(gsisId);
          const dbPlayer = sleeperId ? dbPlayersBySleeperId.get(sleeperId) : undefined;

          if (dbPlayer && proj.pprPoints > 0) {
            await prisma.player.update({
              where: { id: dbPlayer.id },
              data: {
                projectedPoints: Math.round(proj.pprPoints * 10) / 10,
              },
            });
            projectionsUpdated++;
          }
        }

        projectionSeasonUsed = projYear;
        logger.info(`Updated projections for ${projectionsUpdated} players from ${projYear}`);
        break; // Success, don't try other years
      } catch (projError) {
        logger.warn(`Failed to sync projections for ${projYear}`, { error: String(projError) });
      }
    }

    if (projectionsUpdated === 0) {
      logger.warn("No projections synced - data may not be available yet");
    }

    const response = NextResponse.json({
      success: true,
      message: `Synced ${updated} players for ${season} season, ${projectionsUpdated} projections${projectionSeasonUsed ? ` for ${projectionSeasonUsed}` : ""}`,
      season,
      playersUpdated: updated,
      projectionsUpdated,
      projectionSeason: projectionSeasonUsed || null,
      totalNFLVersePlayers: playerStats.size,
    });
    return addRateLimitHeaders(
      response,
      rateLimit.remaining,
      rateLimit.reset,
      rateLimit.limit
    );
  } catch (error) {
    logger.error("Error syncing stats", error);
    return NextResponse.json({ error: "Failed to sync stats" }, { status: 500 });
  }
}
