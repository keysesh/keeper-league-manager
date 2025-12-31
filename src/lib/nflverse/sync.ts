/**
 * NFLverse Sync - Syncs ID mappings and data to database
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { nflverseClient, NFLVerseClient } from "./client";
import { NFLVerseMetadata, NFLVerseSyncResult } from "./types";
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
 * Sync NFLverse stats for all players to PlayerSeasonStats
 */
export async function syncNFLVerseStats(
  season?: number
): Promise<NFLVerseSyncResult> {
  const startTime = Date.now();
  const targetSeason = season || NFLVerseClient.getCurrentSeason();

  logger.info("Starting NFLverse stats sync", { season: targetSeason });

  let playersUpdated = 0;
  let playersFailed = 0;
  const errors: string[] = [];

  try {
    // Get all season stats from NFLverse
    const seasonStats = await nflverseClient.getSeasonStats(targetSeason);
    logger.info("Fetched NFLverse season stats", { count: seasonStats.length });

    // Get players with GSIS IDs from our database
    const dbPlayers = await prisma.player.findMany({
      select: {
        id: true,
        sleeperId: true,
        metadata: true,
      },
    });

    // Build GSIS ID to player ID mapping
    const gsisToPlayerId = new Map<string, string>();
    for (const player of dbPlayers) {
      const metadata = player.metadata as { nflverse?: NFLVerseMetadata } | null;
      if (metadata?.nflverse?.gsisId) {
        gsisToPlayerId.set(metadata.nflverse.gsisId, player.id);
      }
    }

    logger.info("GSIS mapping built", { count: gsisToPlayerId.size });

    // Process stats in batches
    for (let i = 0; i < seasonStats.length; i += BATCH_SIZE) {
      const batch = seasonStats.slice(i, i + BATCH_SIZE);
      const upserts: Promise<unknown>[] = [];

      for (const stats of batch) {
        const playerId = gsisToPlayerId.get(stats.player_id);
        if (!playerId) continue;

        upserts.push(
          prisma.playerSeasonStats
            .upsert({
              where: {
                playerId_season: {
                  playerId,
                  season: targetSeason,
                },
              },
              create: {
                playerId,
                season: targetSeason,
                gamesPlayed: stats.games_played,
                // Passing
                passingYards: stats.passing_yards,
                passingTds: stats.passing_tds,
                interceptions: stats.interceptions,
                // Rushing
                rushingYards: stats.rushing_yards,
                rushingTds: stats.rushing_tds,
                carries: stats.carries,
                // Receiving
                receptions: stats.receptions,
                receivingYards: stats.receiving_yards,
                receivingTds: stats.receiving_tds,
                targets: stats.targets,
                // Fantasy (calculated from NFLverse)
                fantasyPointsPpr: stats.fantasy_points_ppr,
                fantasyPointsHalfPpr: stats.fantasy_points_ppr * 0.9, // Approximate
                fantasyPointsStd: stats.fantasy_points_ppr - stats.receptions, // PPR - receptions
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
                fantasyPointsHalfPpr: stats.fantasy_points_ppr * 0.9,
                fantasyPointsStd: stats.fantasy_points_ppr - stats.receptions,
              },
            })
            .then(() => {
              playersUpdated++;
            })
            .catch((error) => {
              playersFailed++;
              errors.push(`${stats.player_name}: ${error.message}`);
            })
        );
      }

      await Promise.all(upserts);

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
