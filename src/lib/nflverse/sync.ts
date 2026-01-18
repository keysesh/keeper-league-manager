/**
 * NFLverse Sync - Syncs player stats from NFLverse to database
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { nflverseClient, NFLVerseClient } from "./client";
import { sleeperClient } from "@/lib/sleeper/client";
import {
  NFLVerseMetadata,
  NFLVerseSyncResult,
  RankingMetadata,
  DepthChartMetadata,
  InjuryMetadata,
  TeamSchedule,
  TeamRecord,
  StrengthOfSchedule,
} from "./types";
import { Prisma } from "@prisma/client";

const BATCH_SIZE = 100;

/**
 * Sync NFLverse ID mappings and headshots for all players
 * Updates Player.metadata with NFLverse IDs
 */
export async function syncNFLVerseIdMappings(
  season?: number
): Promise<NFLVerseSyncResult> {
  const startTime = Date.now();
  const targetSeason = season || NFLVerseClient.getCurrentSeason();

  logger.info("Starting NFLverse ID mapping sync", { season: targetSeason });

  let playersUpdated = 0;
  let playersFailed = 0;
  const errors: string[] = [];

  try {
    // Get all players with sleeper IDs from our database
    const dbPlayers = await prisma.player.findMany({
      select: {
        id: true,
        sleeperId: true,
        fullName: true,
        metadata: true,
      },
    });

    logger.info("Found players to sync", { count: dbPlayers.length });

    // Build NFLverse mapping
    const nflverseMap = await nflverseClient.buildSleeperIdMapping(targetSeason);
    logger.info("NFLverse mapping built", { mappedCount: nflverseMap.size });

    // Process in batches
    for (let i = 0; i < dbPlayers.length; i += BATCH_SIZE) {
      const batch = dbPlayers.slice(i, i + BATCH_SIZE);
      const updates: Promise<unknown>[] = [];

      for (const player of batch) {
        const nflverseData = nflverseMap.get(player.sleeperId);

        if (!nflverseData) {
          // No NFLverse match - skip silently (many players won't have matches)
          continue;
        }

        // Build NFLverse metadata
        const nflverseMetadata: NFLVerseMetadata = {
          gsisId: nflverseData.gsis_id || undefined,
          espnId: nflverseData.espn_id || undefined,
          pfrId: nflverseData.pfr_id || undefined,
          yahooId: nflverseData.yahoo_id || undefined,
          headshotUrl: nflverseData.headshot_url || undefined,
          lastSync: Date.now(),
        };

        // Merge with existing metadata
        const existingMetadata = (player.metadata as Record<string, unknown>) || {};
        const newMetadata = {
          ...existingMetadata,
          nflverse: nflverseMetadata,
        } as unknown as Prisma.InputJsonValue;

        updates.push(
          prisma.player
            .update({
              where: { id: player.id },
              data: { metadata: newMetadata },
            })
            .then(() => {
              playersUpdated++;
            })
            .catch((error) => {
              playersFailed++;
              errors.push(`${player.fullName}: ${error.message}`);
            })
        );
      }

      // Execute batch
      await Promise.all(updates);

      logger.debug("Batch processed", {
        batchIndex: Math.floor(i / BATCH_SIZE) + 1,
        totalBatches: Math.ceil(dbPlayers.length / BATCH_SIZE),
        playersUpdated,
      });
    }

    const duration = Date.now() - startTime;
    logger.info("NFLverse ID mapping sync complete", {
      playersUpdated,
      playersFailed,
      duration,
      errorCount: errors.length,
    });

    return {
      success: true,
      playersUpdated,
      playersFailed,
      errors: errors.slice(0, 10), // Limit errors returned
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("NFLverse ID mapping sync failed", { error: errorMessage });

    return {
      success: false,
      playersUpdated,
      playersFailed,
      errors: [errorMessage, ...errors.slice(0, 9)],
      duration,
    };
  }
}

/**
 * Sync NFLverse stats for all players - ONE BUTTON DOES EVERYTHING
 * 1. Fetches Sleeper API to get gsis_id → sleeper_id mapping
 * 2. Fetches stats for the season from NFLverse
 * 3. Updates Player model directly with latest stats
 * 4. Also stores in PlayerSeasonStats for history
 */
export async function syncNFLVerseStats(
  season?: number
): Promise<NFLVerseSyncResult & { debug?: Record<string, unknown> }> {
  const startTime = Date.now();
  const targetSeason = season || NFLVerseClient.getCurrentSeason();

  logger.info("Starting NFLverse stats sync", { season: targetSeason });

  let playersUpdated = 0;
  let playersFailed = 0;
  const errors: string[] = [];

  try {
    // Step 1: Fetch Sleeper API to get gsis_id → sleeper_id mapping
    logger.info("Fetching Sleeper player mappings...");
    const sleeperPlayers = await sleeperClient.getAllPlayers();

    // Build gsis_id → sleeper_id mapping
    const gsisToSleeperId = new Map<string, string>();
    for (const [sleeperId, player] of Object.entries(sleeperPlayers)) {
      if (player.gsis_id) {
        gsisToSleeperId.set(player.gsis_id, sleeperId);
      }
    }
    logger.info("Built gsis→sleeper mapping from Sleeper API", { count: gsisToSleeperId.size });

    // Step 2: Get all season stats from NFLverse
    const seasonStats = await nflverseClient.getSeasonStats(targetSeason);
    logger.info("Fetched NFLverse season stats", { count: seasonStats.length });

    // Step 3: Get all players from our database
    const dbPlayers = await prisma.player.findMany({
      select: {
        id: true,
        sleeperId: true,
        fullName: true,
        metadata: true,
      },
    });
    logger.info("Found players in database", { count: dbPlayers.length });

    // Build sleeper_id → db player mapping for quick lookup
    const sleeperToDbPlayer = new Map<string, typeof dbPlayers[0]>();
    for (const player of dbPlayers) {
      sleeperToDbPlayer.set(player.sleeperId, player);
    }

    // Debug info
    const sampleStats = seasonStats.slice(0, 3).map(s => ({ gsis: s.player_id, name: s.player_name }));
    const sampleDbPlayers = dbPlayers.slice(0, 3).map(p => ({ sleeperId: p.sleeperId, name: p.fullName }));
    logger.info("Debug matching", {
      sampleStats,
      sampleDbPlayers,
      gsisToSleeperCount: gsisToSleeperId.size,
      dbPlayerCount: dbPlayers.length,
      statsCount: seasonStats.length,
    });

    // Step 4: Process NFLverse stats and match to DB players
    for (let i = 0; i < seasonStats.length; i += BATCH_SIZE) {
      const batch = seasonStats.slice(i, i + BATCH_SIZE);
      const updates: Promise<unknown>[] = [];

      for (const stats of batch) {
        // NFLverse stats use gsis_id as player_id
        const gsisId = stats.player_id;
        if (!gsisId) continue;

        // Find sleeper_id from gsis_id
        const sleeperId = gsisToSleeperId.get(gsisId);
        if (!sleeperId) continue;

        // Find player in our database
        const player = sleeperToDbPlayer.get(sleeperId);
        if (!player) continue;

        // Calculate points per game
        const pointsPerGame = stats.games_played > 0
          ? stats.fantasy_points_ppr / stats.games_played
          : 0;

        // Update Player model directly with latest stats
        updates.push(
          prisma.player
            .update({
              where: { id: player.id },
              data: {
                fantasyPointsPpr: stats.fantasy_points_ppr,
                fantasyPointsHalfPpr: stats.fantasy_points_ppr - (stats.receptions * 0.5),
                gamesPlayed: stats.games_played,
                pointsPerGame: Math.round(pointsPerGame * 10) / 10,
                statsUpdatedAt: new Date(),
                // Also store GSIS ID in metadata
                metadata: {
                  ...((player.metadata as Record<string, unknown>) || {}),
                  nflverse: {
                    ...((player.metadata as { nflverse?: NFLVerseMetadata })?.nflverse || {}),
                    gsisId,
                    lastSync: Date.now(),
                  },
                } as unknown as Prisma.InputJsonValue,
              },
            })
            .then(() => {
              playersUpdated++;
            })
            .catch((error) => {
              playersFailed++;
              errors.push(`${player.fullName}: ${error.message}`);
            })
        );

        // Also upsert to PlayerSeasonStats for historical data
        updates.push(
          prisma.playerSeasonStats
            .upsert({
              where: {
                playerId_season: {
                  playerId: player.id,
                  season: targetSeason,
                },
              },
              create: {
                playerId: player.id,
                season: targetSeason,
                gamesPlayed: stats.games_played,
                passingYards: stats.passing_yards,
                passingTds: stats.passing_tds,
                interceptions: stats.interceptions,
                rushingYards: stats.rushing_yards,
                rushingTds: stats.rushing_tds,
                carries: stats.carries,
                receptions: stats.receptions,
                receivingYards: stats.receiving_yards,
                receivingTds: stats.receiving_tds,
                targets: stats.targets,
                fantasyPointsPpr: stats.fantasy_points_ppr,
                fantasyPointsHalfPpr: stats.fantasy_points_ppr - (stats.receptions * 0.5),
                fantasyPointsStd: stats.fantasy_points_ppr - stats.receptions,
              },
              update: {
                gamesPlayed: stats.games_played,
                passingYards: stats.passing_yards,
                passingTds: stats.passing_tds,
                interceptions: stats.interceptions,
                rushingYards: stats.rushing_yards,
                rushingTds: stats.rushing_tds,
                carries: stats.carries,
                receptions: stats.receptions,
                receivingYards: stats.receiving_yards,
                receivingTds: stats.receiving_tds,
                targets: stats.targets,
                fantasyPointsPpr: stats.fantasy_points_ppr,
                fantasyPointsHalfPpr: stats.fantasy_points_ppr - (stats.receptions * 0.5),
                fantasyPointsStd: stats.fantasy_points_ppr - stats.receptions,
              },
            })
            .catch((error) => {
              // Don't count this as a failure, Player update is what matters
              logger.warn("Failed to upsert season stats", { error: error.message });
            })
        );
      }

      await Promise.all(updates);

      logger.debug("Stats batch processed", {
        batchIndex: Math.floor(i / BATCH_SIZE) + 1,
        playersUpdated,
      });
    }

    const duration = Date.now() - startTime;
    logger.info("NFLverse stats sync complete", {
      playersUpdated,
      playersFailed,
      duration,
    });

    return {
      success: true,
      playersUpdated,
      playersFailed,
      errors: errors.slice(0, 10),
      duration,
      debug: {
        dbPlayerCount: dbPlayers.length,
        gsisToSleeperCount: gsisToSleeperId.size,
        statsCount: seasonStats.length,
        sampleDbPlayers,
        sampleStats,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("NFLverse stats sync failed", { error: errorMessage });

    return {
      success: false,
      playersUpdated,
      playersFailed,
      errors: [errorMessage, ...errors.slice(0, 9)],
      duration,
    };
  }
}

/**
 * Sync NFLverse projections for upcoming season
 * Updates Player.projectedPoints for keeper planning
 */
export async function syncNFLVerseProjections(
  season?: number
): Promise<NFLVerseSyncResult> {
  const startTime = Date.now();
  // For projections, default to next season (current year if before Sept, else next year)
  const now = new Date();
  const defaultSeason = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
  const targetSeason = season || defaultSeason;

  logger.info("Starting NFLverse projections sync", { season: targetSeason });

  let playersUpdated = 0;
  let playersFailed = 0;
  const errors: string[] = [];

  try {
    // Fetch projections from NFLverse
    const projections = await nflverseClient.getProjections(targetSeason);
    logger.info("Fetched NFLverse projections", { count: projections.length });

    if (projections.length === 0) {
      return {
        success: true,
        playersUpdated: 0,
        playersFailed: 0,
        errors: [`No projections available for ${targetSeason} season yet`],
        duration: Date.now() - startTime,
      };
    }

    // Get all players from database
    const dbPlayers = await prisma.player.findMany({
      select: {
        id: true,
        sleeperId: true,
        fullName: true,
        metadata: true,
      },
    });

    // Build lookup maps (sleeper ID and GSIS ID)
    const sleeperToPlayer = new Map<string, { id: string; fullName: string }>();
    const gsisToPlayer = new Map<string, { id: string; fullName: string }>();

    for (const player of dbPlayers) {
      sleeperToPlayer.set(player.sleeperId, { id: player.id, fullName: player.fullName });
      const metadata = player.metadata as { nflverse?: NFLVerseMetadata } | null;
      if (metadata?.nflverse?.gsisId) {
        gsisToPlayer.set(metadata.nflverse.gsisId, { id: player.id, fullName: player.fullName });
      }
    }

    // Process projections in batches
    for (let i = 0; i < projections.length; i += BATCH_SIZE) {
      const batch = projections.slice(i, i + BATCH_SIZE);
      const updates: Promise<unknown>[] = [];

      for (const proj of batch) {
        // Try to match by sleeper_id first, then gsis_id
        let playerMatch = proj.sleeper_id ? sleeperToPlayer.get(proj.sleeper_id) : null;
        if (!playerMatch && proj.gsis_id) {
          playerMatch = gsisToPlayer.get(proj.gsis_id);
        }
        if (!playerMatch && proj.player_id) {
          playerMatch = gsisToPlayer.get(proj.player_id);
        }

        if (!playerMatch) continue;

        // Calculate projected fantasy points (prefer PPR)
        const projectedPoints = proj.fantasy_points_ppr || proj.fantasy_points || 0;

        if (projectedPoints <= 0) continue;

        updates.push(
          prisma.player
            .update({
              where: { id: playerMatch.id },
              data: { projectedPoints },
            })
            .then(() => {
              playersUpdated++;
            })
            .catch((error) => {
              playersFailed++;
              errors.push(`${playerMatch!.fullName}: ${error.message}`);
            })
        );
      }

      await Promise.all(updates);

      logger.debug("Projections batch processed", {
        batchIndex: Math.floor(i / BATCH_SIZE) + 1,
        playersUpdated,
      });
    }

    const duration = Date.now() - startTime;
    logger.info("NFLverse projections sync complete", {
      playersUpdated,
      playersFailed,
      duration,
    });

    return {
      success: true,
      playersUpdated,
      playersFailed,
      errors: errors.slice(0, 10),
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("NFLverse projections sync failed", { error: errorMessage });

    return {
      success: false,
      playersUpdated,
      playersFailed,
      errors: [errorMessage, ...errors.slice(0, 9)],
      duration,
    };
  }
}

/**
 * Run full NFLverse sync (ID mappings + stats)
 */
export async function syncNFLVerseData(
  season?: number
): Promise<{ idMapping: NFLVerseSyncResult; stats: NFLVerseSyncResult }> {
  const targetSeason = season || NFLVerseClient.getCurrentSeason();

  logger.info("Starting full NFLverse sync", { season: targetSeason });

  // First sync ID mappings
  const idMappingResult = await syncNFLVerseIdMappings(targetSeason);

  // Then sync stats (requires ID mappings to exist)
  const statsResult = await syncNFLVerseStats(targetSeason);

  logger.info("Full NFLverse sync complete", {
    idMappingPlayersUpdated: idMappingResult.playersUpdated,
    statsPlayersUpdated: statsResult.playersUpdated,
  });

  return {
    idMapping: idMappingResult,
    stats: statsResult,
  };
}

/**
 * Sync FantasyPros rankings for all players
 * Updates Player.metadata with ECR (Expert Consensus Ranking)
 */
export async function syncFFRankings(): Promise<NFLVerseSyncResult> {
  const startTime = Date.now();

  logger.info("Starting FantasyPros rankings sync");

  let playersUpdated = 0;
  let playersFailed = 0;
  const errors: string[] = [];

  try {
    // Step 1: Get rankings with sleeper_id mapping
    const rankings = await nflverseClient.getFFRankings();
    logger.info("Fetched FF rankings", { count: rankings.length });

    if (rankings.length === 0) {
      return {
        success: true,
        playersUpdated: 0,
        playersFailed: 0,
        errors: ["No rankings data available"],
        duration: Date.now() - startTime,
      };
    }

    // Get the scrape date from first ranking
    const scrapeDate = rankings[0]?.scrape_date;

    // Step 2: Get all players from database
    const dbPlayers = await prisma.player.findMany({
      select: {
        id: true,
        sleeperId: true,
        fullName: true,
        metadata: true,
      },
    });

    // Build sleeper_id → db player mapping
    const sleeperToDbPlayer = new Map<string, (typeof dbPlayers)[0]>();
    for (const player of dbPlayers) {
      sleeperToDbPlayer.set(player.sleeperId, player);
    }

    // Step 3: Process rankings in batches
    for (let i = 0; i < rankings.length; i += BATCH_SIZE) {
      const batch = rankings.slice(i, i + BATCH_SIZE);
      const updates: Promise<unknown>[] = [];

      for (const ranking of batch) {
        if (!ranking.sleeper_id) continue;

        // Convert to string since DB stores sleeperId as string
        const sleeperId = String(ranking.sleeper_id);
        const player = sleeperToDbPlayer.get(sleeperId);
        if (!player) continue;

        // Extract position rank from page_pos (e.g., "RB12" -> 12)
        const posRankMatch = ranking.page_pos?.match(/\d+$/);
        const positionRank = posRankMatch ? parseInt(posRankMatch[0], 10) : undefined;

        // Build ranking metadata
        const rankingMetadata: RankingMetadata = {
          ecr: ranking.ecr,
          positionRank,
          rankingDate: scrapeDate,
        };

        // Merge with existing metadata
        const existingMetadata = (player.metadata as Record<string, unknown>) || {};
        const existingNflverse = (existingMetadata.nflverse as NFLVerseMetadata) || {};
        const newMetadata = {
          ...existingMetadata,
          nflverse: {
            ...existingNflverse,
            ranking: rankingMetadata,
          },
        } as unknown as Prisma.InputJsonValue;

        updates.push(
          prisma.player
            .update({
              where: { id: player.id },
              data: { metadata: newMetadata },
            })
            .then(() => {
              playersUpdated++;
            })
            .catch((error) => {
              playersFailed++;
              errors.push(`${player.fullName}: ${error.message}`);
            })
        );
      }

      await Promise.all(updates);

      logger.debug("Rankings batch processed", {
        batchIndex: Math.floor(i / BATCH_SIZE) + 1,
        playersUpdated,
      });
    }

    const duration = Date.now() - startTime;
    logger.info("FF rankings sync complete", {
      playersUpdated,
      playersFailed,
      duration,
    });

    return {
      success: true,
      playersUpdated,
      playersFailed,
      errors: errors.slice(0, 10),
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("FF rankings sync failed", { error: errorMessage });

    return {
      success: false,
      playersUpdated,
      playersFailed,
      errors: [errorMessage, ...errors.slice(0, 9)],
      duration,
    };
  }
}

/**
 * Sync depth charts for all players
 * Updates Player.metadata with depth chart position
 */
export async function syncDepthCharts(
  season?: number
): Promise<NFLVerseSyncResult> {
  const startTime = Date.now();
  const targetSeason = season || NFLVerseClient.getCurrentSeason();

  logger.info("Starting depth charts sync", { season: targetSeason });

  let playersUpdated = 0;
  let playersFailed = 0;
  const errors: string[] = [];

  try {
    // Step 1: Fetch Sleeper API to get gsis_id → sleeper_id mapping
    const sleeperPlayers = await sleeperClient.getAllPlayers();

    const gsisToSleeperId = new Map<string, string>();
    for (const [sleeperId, player] of Object.entries(sleeperPlayers)) {
      if (player.gsis_id) {
        gsisToSleeperId.set(player.gsis_id, sleeperId);
      }
    }

    // Step 2: Get latest depth charts from NFLverse
    const depthCharts = await nflverseClient.getLatestDepthCharts(targetSeason);
    logger.info("Fetched depth charts", { count: depthCharts.size });

    if (depthCharts.size === 0) {
      return {
        success: true,
        playersUpdated: 0,
        playersFailed: 0,
        errors: [`No depth chart data available for ${targetSeason}`],
        duration: Date.now() - startTime,
      };
    }

    // Step 3: Get all players from database
    const dbPlayers = await prisma.player.findMany({
      select: {
        id: true,
        sleeperId: true,
        fullName: true,
        metadata: true,
      },
    });

    const sleeperToDbPlayer = new Map<string, (typeof dbPlayers)[0]>();
    for (const player of dbPlayers) {
      sleeperToDbPlayer.set(player.sleeperId, player);
    }

    // Step 4: Process depth charts
    const dcEntries = Array.from(depthCharts.entries());
    for (let i = 0; i < dcEntries.length; i += BATCH_SIZE) {
      const batch = dcEntries.slice(i, i + BATCH_SIZE);
      const updates: Promise<unknown>[] = [];

      for (const [gsisId, dc] of batch) {
        const sleeperId = gsisToSleeperId.get(gsisId);
        if (!sleeperId) continue;

        const player = sleeperToDbPlayer.get(sleeperId);
        if (!player) continue;

        // Build depth chart metadata
        const depthChartMetadata: DepthChartMetadata = {
          depthPosition: dc.depth_position || dc.depth_team,
          formation: dc.formation,
          lastUpdated: Date.now(),
        };

        // Merge with existing metadata
        const existingMetadata = (player.metadata as Record<string, unknown>) || {};
        const existingNflverse = (existingMetadata.nflverse as NFLVerseMetadata) || {};
        const newMetadata = {
          ...existingMetadata,
          nflverse: {
            ...existingNflverse,
            depthChart: depthChartMetadata,
          },
        } as unknown as Prisma.InputJsonValue;

        updates.push(
          prisma.player
            .update({
              where: { id: player.id },
              data: { metadata: newMetadata },
            })
            .then(() => {
              playersUpdated++;
            })
            .catch((error) => {
              playersFailed++;
              errors.push(`${player.fullName}: ${error.message}`);
            })
        );
      }

      await Promise.all(updates);

      logger.debug("Depth charts batch processed", {
        batchIndex: Math.floor(i / BATCH_SIZE) + 1,
        playersUpdated,
      });
    }

    const duration = Date.now() - startTime;
    logger.info("Depth charts sync complete", {
      playersUpdated,
      playersFailed,
      duration,
    });

    return {
      success: true,
      playersUpdated,
      playersFailed,
      errors: errors.slice(0, 10),
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Depth charts sync failed", { error: errorMessage });

    return {
      success: false,
      playersUpdated,
      playersFailed,
      errors: [errorMessage, ...errors.slice(0, 9)],
      duration,
    };
  }
}

/**
 * Sync injury reports for all players
 * Updates Player.metadata with injury status
 * Note: Injury data may not be available for future seasons
 */
export async function syncInjuries(
  season?: number
): Promise<NFLVerseSyncResult> {
  const startTime = Date.now();
  const targetSeason = season || NFLVerseClient.getCurrentSeason();

  logger.info("Starting injuries sync", { season: targetSeason });

  let playersUpdated = 0;
  let playersFailed = 0;
  const errors: string[] = [];

  try {
    // Step 1: Fetch Sleeper API to get gsis_id → sleeper_id mapping
    const sleeperPlayers = await sleeperClient.getAllPlayers();

    const gsisToSleeperId = new Map<string, string>();
    for (const [sleeperId, player] of Object.entries(sleeperPlayers)) {
      if (player.gsis_id) {
        gsisToSleeperId.set(player.gsis_id, sleeperId);
      }
    }

    // Step 2: Get latest injuries from NFLverse
    const injuries = await nflverseClient.getLatestInjuries(targetSeason);
    logger.info("Fetched injuries", { count: injuries.size });

    if (injuries.size === 0) {
      return {
        success: true,
        playersUpdated: 0,
        playersFailed: 0,
        errors: [`No injury data available for ${targetSeason} (may not be published yet)`],
        duration: Date.now() - startTime,
      };
    }

    // Step 3: Get all players from database
    const dbPlayers = await prisma.player.findMany({
      select: {
        id: true,
        sleeperId: true,
        fullName: true,
        metadata: true,
      },
    });

    const sleeperToDbPlayer = new Map<string, (typeof dbPlayers)[0]>();
    for (const player of dbPlayers) {
      sleeperToDbPlayer.set(player.sleeperId, player);
    }

    // Step 4: Process injuries
    const injEntries = Array.from(injuries.entries());
    for (let i = 0; i < injEntries.length; i += BATCH_SIZE) {
      const batch = injEntries.slice(i, i + BATCH_SIZE);
      const updates: Promise<unknown>[] = [];

      for (const [gsisId, inj] of batch) {
        const sleeperId = gsisToSleeperId.get(gsisId);
        if (!sleeperId) continue;

        const player = sleeperToDbPlayer.get(sleeperId);
        if (!player) continue;

        // Build injury metadata
        const injuryMetadata: InjuryMetadata = {
          status: inj.report_status,
          primaryInjury: inj.report_primary_injury,
          secondaryInjury: inj.report_secondary_injury || undefined,
          practiceStatus: inj.practice_status || undefined,
          lastUpdated: Date.now(),
        };

        // Merge with existing metadata
        const existingMetadata = (player.metadata as Record<string, unknown>) || {};
        const existingNflverse = (existingMetadata.nflverse as NFLVerseMetadata) || {};
        const newMetadata = {
          ...existingMetadata,
          nflverse: {
            ...existingNflverse,
            injury: injuryMetadata,
          },
        } as unknown as Prisma.InputJsonValue;

        updates.push(
          prisma.player
            .update({
              where: { id: player.id },
              data: { metadata: newMetadata },
            })
            .then(() => {
              playersUpdated++;
            })
            .catch((error) => {
              playersFailed++;
              errors.push(`${player.fullName}: ${error.message}`);
            })
        );
      }

      await Promise.all(updates);

      logger.debug("Injuries batch processed", {
        batchIndex: Math.floor(i / BATCH_SIZE) + 1,
        playersUpdated,
      });
    }

    const duration = Date.now() - startTime;
    logger.info("Injuries sync complete", {
      playersUpdated,
      playersFailed,
      duration,
    });

    return {
      success: true,
      playersUpdated,
      playersFailed,
      errors: errors.slice(0, 10),
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Injuries sync failed", { error: errorMessage });

    return {
      success: false,
      playersUpdated,
      playersFailed,
      errors: [errorMessage, ...errors.slice(0, 9)],
      duration,
    };
  }
}

/**
 * Schedule sync result with team data
 */
export interface ScheduleSyncResult {
  success: boolean;
  season: number;
  teamsProcessed: number;
  gamesProcessed: number;
  schedules: Record<string, TeamSchedule>;
  records: Record<string, TeamRecord>;
  strengthOfSchedule: Record<string, StrengthOfSchedule>;
  errors: string[];
  duration: number;
}

/**
 * Sync NFL schedule data for a season
 * Returns team schedules, bye weeks, records, and strength of schedule
 *
 * For keeper planning: defaults to upcoming season
 * Note: NFL schedule is typically released in May
 */
export async function syncSchedule(
  season?: number
): Promise<ScheduleSyncResult> {
  const startTime = Date.now();
  // Default to upcoming season for keeper planning
  const targetSeason = season || NFLVerseClient.getUpcomingSeason();

  logger.info("Starting schedule sync", { season: targetSeason });

  const errors: string[] = [];

  try {
    // Fetch schedule data
    const games = await nflverseClient.getSchedule(targetSeason);
    const regularGames = games.filter((g) => g.game_type === "REG");

    logger.info("Fetched schedule", {
      totalGames: games.length,
      regularGames: regularGames.length
    });

    if (games.length === 0) {
      // Schedule not yet released - this is expected before May
      const now = new Date();
      const releaseMonth = now.getMonth() < 4 ? "May" : "soon";
      return {
        success: false,
        season: targetSeason,
        teamsProcessed: 0,
        gamesProcessed: 0,
        schedules: {},
        records: {},
        strengthOfSchedule: {},
        errors: [`${targetSeason} NFL schedule not yet released (typically available in ${releaseMonth})`],
        duration: Date.now() - startTime,
      };
    }

    // Get team schedules (includes bye weeks)
    const schedulesMap = await nflverseClient.getTeamSchedules(targetSeason);
    const schedules: Record<string, TeamSchedule> = {};
    for (const [team, schedule] of schedulesMap) {
      schedules[team] = schedule;
    }

    // Get team records
    const recordsMap = await nflverseClient.getTeamRecords(targetSeason);
    const records: Record<string, TeamRecord> = {};
    for (const [team, record] of recordsMap) {
      records[team] = record;
    }

    // Get strength of schedule
    const sosMap = await nflverseClient.getStrengthOfSchedule(targetSeason);
    const strengthOfSchedule: Record<string, StrengthOfSchedule> = {};
    for (const [team, sos] of sosMap) {
      strengthOfSchedule[team] = sos;
    }

    const duration = Date.now() - startTime;
    logger.info("Schedule sync complete", {
      season: targetSeason,
      teams: Object.keys(schedules).length,
      games: regularGames.length,
      duration,
    });

    return {
      success: true,
      season: targetSeason,
      teamsProcessed: Object.keys(schedules).length,
      gamesProcessed: regularGames.length,
      schedules,
      records,
      strengthOfSchedule,
      errors,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Schedule sync failed", { error: errorMessage });

    return {
      success: false,
      season: targetSeason,
      teamsProcessed: 0,
      gamesProcessed: 0,
      schedules: {},
      records: {},
      strengthOfSchedule: {},
      errors: [errorMessage],
      duration,
    };
  }
}

/**
 * Get bye week for a specific team
 */
export async function getTeamByeWeek(
  team: string,
  season?: number
): Promise<number | null> {
  const targetSeason = season || NFLVerseClient.getCurrentSeason();

  try {
    const byeWeeks = await nflverseClient.getByeWeeks(targetSeason);
    return byeWeeks.get(team) || null;
  } catch (error) {
    logger.warn("Failed to get bye week", { team, season: targetSeason, error });
    return null;
  }
}

/**
 * Get NFLverse metadata for a single player (on-demand)
 */
export async function getPlayerNFLVerseData(
  sleeperId: string,
  season?: number
): Promise<NFLVerseMetadata | null> {
  const targetSeason = season || NFLVerseClient.getCurrentSeason();

  // Check if we have cached data in DB
  const player = await prisma.player.findUnique({
    where: { sleeperId },
    select: { metadata: true },
  });

  const metadata = player?.metadata as { nflverse?: NFLVerseMetadata } | null;
  const nflverse = metadata?.nflverse;

  // Return cached if fresh (within 7 days)
  if (nflverse?.lastSync && Date.now() - nflverse.lastSync < 7 * 24 * 60 * 60 * 1000) {
    return nflverse;
  }

  // Fetch fresh data
  try {
    const { roster } = await nflverseClient.findPlayerBySleeperId(
      sleeperId,
      targetSeason
    );

    if (!roster) return nflverse || null; // Return stale data if no match

    const newMetadata: NFLVerseMetadata = {
      gsisId: roster.gsis_id || undefined,
      espnId: roster.espn_id || undefined,
      pfrId: roster.pfr_id || undefined,
      yahooId: roster.yahoo_id || undefined,
      headshotUrl: roster.headshot_url || undefined,
      lastSync: Date.now(),
    };

    // Update in DB (fire and forget)
    const updatedMetadata = {
      ...(metadata || {}),
      nflverse: newMetadata,
    } as unknown as Prisma.InputJsonValue;

    prisma.player
      .update({
        where: { sleeperId },
        data: { metadata: updatedMetadata },
      })
      .catch((err) => logger.warn("Failed to cache NFLverse data", { err }));

    return newMetadata;
  } catch (error) {
    logger.warn("Failed to fetch NFLverse data for player", {
      sleeperId,
      error,
    });
    return nflverse || null;
  }
}
