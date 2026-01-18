/**
 * NFLverse Sync - Syncs player stats from NFLverse to database
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
 * Sync NFLverse stats for all players - ONE BUTTON DOES EVERYTHING
 * 1. Fetches roster data to get sleeper_id → gsis_id mapping
 * 2. Fetches stats for the season
 * 3. Updates Player model directly with latest stats
 * 4. Also stores in PlayerSeasonStats for history
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
    // Step 1: Get roster data to build sleeper_id → gsis_id mapping
    const rosters = await nflverseClient.getRosters(targetSeason);
    logger.info("Fetched NFLverse rosters", { count: rosters.length });

    // Build sleeper_id → gsis_id mapping from rosters
    const sleeperToGsis = new Map<string, string>();
    for (const roster of rosters) {
      if (roster.sleeper_id && roster.gsis_id) {
        sleeperToGsis.set(roster.sleeper_id, roster.gsis_id);
      }
    }
    logger.info("Built sleeper→gsis mapping", { count: sleeperToGsis.size });

    // Step 2: Get all season stats from NFLverse
    const seasonStats = await nflverseClient.getSeasonStats(targetSeason);
    logger.info("Fetched NFLverse season stats", { count: seasonStats.length });

    // Build gsis_id → stats mapping for quick lookup
    const gsisToStats = new Map<string, typeof seasonStats[0]>();
    for (const stats of seasonStats) {
      if (stats.player_id) {
        gsisToStats.set(stats.player_id, stats);
      }
    }

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

    // Step 4: Process players in batches
    for (let i = 0; i < dbPlayers.length; i += BATCH_SIZE) {
      const batch = dbPlayers.slice(i, i + BATCH_SIZE);
      const updates: Promise<unknown>[] = [];

      for (const player of batch) {
        // Find GSIS ID for this player
        const gsisId = sleeperToGsis.get(player.sleeperId);
        if (!gsisId) continue;

        // Find stats for this player
        const stats = gsisToStats.get(gsisId);
        if (!stats) continue;

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
                // Also store GSIS ID in metadata if not present
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
