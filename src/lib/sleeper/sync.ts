import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { SleeperClient } from "./client";
import {
  mapSleeperPlayer,
  mapSleeperRoster,
  mapSleeperLeague,
  mapSleeperDraftStatus,
  mapSleeperTransaction,
  mapSleeperTradedPick,
} from "./mappers";
import { logger } from "@/lib/logger";
import {
  DB_BATCH_SIZE,
  PROGRESS_LOG_INTERVAL,
  DEFAULT_KEEPER_SETTINGS,
  DEFAULT_DRAFT_ROUNDS,
  MAX_HISTORICAL_SEASONS,
} from "@/lib/constants";

const sleeper = new SleeperClient();

// ============================================
// PLAYER SYNC
// ============================================

/**
 * Sync all NFL players from Sleeper
 * This is a large operation (~10,000 players) - run sparingly
 */
export async function syncAllPlayers(): Promise<{
  created: number;
  updated: number;
}> {
  logger.info("Starting player sync");
  const players = await sleeper.getAllPlayers();
  const playerEntries = Object.entries(players);

  const created = 0;
  const updated = 0;

  // Process in batches for performance
  for (let i = 0; i < playerEntries.length; i += DB_BATCH_SIZE) {
    const batch = playerEntries.slice(i, i + DB_BATCH_SIZE);

    await prisma.$transaction(
      batch.map(([playerId, player]) => {
        const data = mapSleeperPlayer(player);
        return prisma.player.upsert({
          where: { sleeperId: playerId },
          update: data,
          create: { sleeperId: playerId, ...data },
        });
      })
    );

    // Log progress at intervals
    if ((i + DB_BATCH_SIZE) % PROGRESS_LOG_INTERVAL === 0) {
      logger.syncProgress("Player sync", i + DB_BATCH_SIZE, playerEntries.length);
    }
  }

  logger.info("Player sync complete", { total: playerEntries.length });
  return { created, updated };
}

// ============================================
// LEAGUE SYNC
// ============================================

/**
 * Sync a single league and all its data
 */
export async function syncLeague(sleeperLeagueId: string): Promise<{
  league: { id: string; name: string };
  rosters: number;
  players: number;
  draftPicks: number;
}> {
  logger.info("Syncing league", { sleeperLeagueId });

  // Fetch all league data in parallel
  const [leagueData, rosters, users, drafts, tradedPicks] = await Promise.all([
    sleeper.getLeague(sleeperLeagueId),
    sleeper.getRosters(sleeperLeagueId),
    sleeper.getUsers(sleeperLeagueId),
    sleeper.getDrafts(sleeperLeagueId),
    sleeper.getTradedPicks(sleeperLeagueId),
  ]);

  // Find commissioner (user with is_owner: true)
  const commissionerSleeperUser = users.find((u) => u.is_owner);
  let commissionerId: string | null = null;

  if (commissionerSleeperUser) {
    const commissionerDbUser = await prisma.user.findUnique({
      where: { sleeperId: commissionerSleeperUser.user_id },
    });
    commissionerId = commissionerDbUser?.id || null;
  }

  // Upsert league
  const league = await prisma.league.upsert({
    where: { sleeperId: sleeperLeagueId },
    update: {
      ...mapSleeperLeague(leagueData),
      commissionerId,
      lastSyncedAt: new Date(),
    },
    create: {
      sleeperId: sleeperLeagueId,
      ...mapSleeperLeague(leagueData),
      commissionerId,
      lastSyncedAt: new Date(),
    },
  });

  // Ensure keeper settings exist
  await prisma.keeperSettings.upsert({
    where: { leagueId: league.id },
    update: {},
    create: {
      leagueId: league.id,
      ...DEFAULT_KEEPER_SETTINGS,
    },
  });

  // Create user map for team names
  const userMap = new Map(users.map((u) => [u.user_id, u]));

  // Batch fetch all players we'll need (optimization: 1 query instead of ~200)
  const allPlayerIds = new Set<string>();
  for (const roster of rosters) {
    roster.players?.forEach(id => allPlayerIds.add(id));
  }
  const existingPlayers = await prisma.player.findMany({
    where: { sleeperId: { in: Array.from(allPlayerIds) } },
    select: { id: true, sleeperId: true },
  });
  const playerMap = new Map(existingPlayers.map(p => [p.sleeperId, p.id]));

  // Sync rosters
  let rosterCount = 0;
  let playerCount = 0;

  for (const roster of rosters) {
    const user = userMap.get(roster.owner_id);
    const rosterData = mapSleeperRoster(roster, user);

    const dbRoster = await prisma.roster.upsert({
      where: {
        leagueId_sleeperId: {
          leagueId: league.id,
          sleeperId: String(roster.roster_id),
        },
      },
      update: rosterData,
      create: {
        leagueId: league.id,
        sleeperId: String(roster.roster_id),
        ...rosterData,
      },
    });

    rosterCount++;

    // Link user to roster if they exist in our system
    if (roster.owner_id) {
      const dbUser = await prisma.user.findUnique({
        where: { sleeperId: roster.owner_id },
      });

      if (dbUser) {
        await prisma.teamMember.upsert({
          where: {
            userId_rosterId: {
              userId: dbUser.id,
              rosterId: dbRoster.id,
            },
          },
          update: {},
          create: {
            userId: dbUser.id,
            rosterId: dbRoster.id,
            role: "OWNER",
          },
        });
      }
    }

    // Sync roster players using batch operations
    if (roster.players && roster.players.length > 0) {
      await prisma.rosterPlayer.deleteMany({
        where: { rosterId: dbRoster.id },
      });

      // Build batch insert data using pre-fetched player map
      const rosterPlayerData = roster.players
        .map(playerId => {
          const dbPlayerId = playerMap.get(playerId);
          if (!dbPlayerId) return null;
          return {
            rosterId: dbRoster.id,
            playerId: dbPlayerId,
            isStarter: roster.starters?.includes(playerId) || false,
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);

      if (rosterPlayerData.length > 0) {
        await prisma.rosterPlayer.createMany({ data: rosterPlayerData });
        playerCount += rosterPlayerData.length;
      }
    }
  }

  // Sync traded picks
  for (const pick of tradedPicks) {
    const mappedPick = mapSleeperTradedPick(pick);

    await prisma.tradedPick.upsert({
      where: {
        leagueId_season_round_originalOwnerId: {
          leagueId: league.id,
          season: mappedPick.season,
          round: mappedPick.round,
          originalOwnerId: mappedPick.originalOwnerId,
        },
      },
      update: {
        currentOwnerId: mappedPick.currentOwnerId,
      },
      create: {
        leagueId: league.id,
        ...mappedPick,
      },
    });
  }

  // Sync drafts
  let draftPickCount = 0;
  for (const draft of drafts) {
    try {
      draftPickCount += await syncDraft(league.id, draft);
    } catch (err) {
      logger.warn("Failed to sync draft", { draftId: draft.draft_id, error: err instanceof Error ? err.message : err });
    }
  }

  // Sync transactions (waivers, trades, FA pickups)
  try {
    const transactionCount = await syncTransactions(league.id);
    logger.info("Synced transactions", { leagueName: league.name, count: transactionCount });
  } catch (err) {
    logger.warn("Failed to sync transactions", { leagueName: league.name, error: err instanceof Error ? err.message : err });
  }

  logger.info("League sync complete", { leagueName: league.name });
  return {
    league: { id: league.id, name: league.name },
    rosters: rosterCount,
    players: playerCount,
    draftPicks: draftPickCount,
  };
}

// ============================================
// DRAFT SYNC
// ============================================

/**
 * Sync a single draft and its picks
 */
async function syncDraft(leagueId: string, draftData: {
  draft_id: string;
  season: string;
  status: string;
  type: string;
  start_time?: number | null;
  settings?: Record<string, unknown> | null;
  slot_to_roster_id?: Record<string, number> | null;
}): Promise<number> {
  const picks = await sleeper.getDraftPicks(draftData.draft_id);

  // Upsert draft
  const draft = await prisma.draft.upsert({
    where: { sleeperId: draftData.draft_id },
    update: {
      status: mapSleeperDraftStatus(draftData.status),
      startTime: draftData.start_time ? new Date(draftData.start_time) : null,
      draftOrder: draftData.slot_to_roster_id
        ? (draftData.slot_to_roster_id as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      settings: draftData.settings
        ? (draftData.settings as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
    create: {
      sleeperId: draftData.draft_id,
      leagueId,
      season: parseInt(draftData.season),
      type: draftData.type === "auction" ? "AUCTION" : draftData.type === "linear" ? "LINEAR" : "SNAKE",
      status: mapSleeperDraftStatus(draftData.status),
      startTime: draftData.start_time ? new Date(draftData.start_time) : null,
      rounds: typeof draftData.settings?.rounds === 'number' ? draftData.settings.rounds : DEFAULT_DRAFT_ROUNDS,
      draftOrder: draftData.slot_to_roster_id
        ? (draftData.slot_to_roster_id as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      settings: draftData.settings
        ? (draftData.settings as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });

  // Batch fetch all rosters for this league
  const rosters = await prisma.roster.findMany({
    where: { leagueId },
    select: { id: true, sleeperId: true },
  });
  const rosterMap = new Map(rosters.map(r => [r.sleeperId, r.id]));

  // Batch fetch all players we need
  const playerSleeperIds = picks.filter(p => p.player_id).map(p => p.player_id!);
  const players = await prisma.player.findMany({
    where: { sleeperId: { in: playerSleeperIds } },
    select: { id: true, sleeperId: true },
  });
  const playerMap = new Map(players.map(p => [p.sleeperId, p.id]));

  // Sync draft picks with batch-fetched data
  let pickCount = 0;
  for (const pick of picks) {
    const rosterId = rosterMap.get(String(pick.roster_id));
    if (!rosterId) continue;

    const playerId = pick.player_id ? playerMap.get(pick.player_id) || null : null;

    await prisma.draftPick.upsert({
      where: {
        draftId_round_draftSlot: {
          draftId: draft.id,
          round: pick.round,
          draftSlot: pick.draft_slot,
        },
      },
      update: {
        rosterId,
        playerId,
        pickNumber: pick.pick_no,
        isKeeper: pick.is_keeper || false,
        metadata: pick.metadata
          ? (pick.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      create: {
        draftId: draft.id,
        rosterId,
        playerId,
        round: pick.round,
        pickNumber: pick.pick_no,
        draftSlot: pick.draft_slot,
        isKeeper: pick.is_keeper || false,
        metadata: pick.metadata
          ? (pick.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    pickCount++;
  }

  return pickCount;
}

// ============================================
// TRANSACTION SYNC
// ============================================

/**
 * Sync all transactions for a league
 * Optimized with batch fetching to avoid N+1 queries
 */
export async function syncTransactions(leagueId: string): Promise<number> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
  });

  if (!league) {
    throw new Error("League not found");
  }

  const allTransactions = await sleeper.getAllTransactions(league.sleeperId);

  if (allTransactions.length === 0) {
    return 0;
  }

  // Batch fetch all players and rosters we'll need (optimization: 2 queries instead of N*3)
  const allPlayerIds = new Set<string>();
  const allRosterSleeperIds = new Set<string>();

  for (const trans of allTransactions) {
    if (trans.adds) {
      Object.keys(trans.adds).forEach(id => allPlayerIds.add(id));
      Object.values(trans.adds).forEach(id => allRosterSleeperIds.add(String(id)));
    }
    if (trans.drops) {
      Object.keys(trans.drops).forEach(id => allPlayerIds.add(id));
      Object.values(trans.drops).forEach(id => allRosterSleeperIds.add(String(id)));
    }
  }

  const [players, rosters] = await Promise.all([
    prisma.player.findMany({
      where: { sleeperId: { in: Array.from(allPlayerIds) } },
      select: { id: true, sleeperId: true },
    }),
    prisma.roster.findMany({
      where: { leagueId, sleeperId: { in: Array.from(allRosterSleeperIds) } },
      select: { id: true, sleeperId: true },
    }),
  ]);

  const playerMap = new Map(players.map(p => [p.sleeperId, p.id]));
  const rosterMap = new Map(rosters.map(r => [r.sleeperId, r.id]));

  let count = 0;

  // Process transactions in batches with transaction wrapper for data consistency
  for (let i = 0; i < allTransactions.length; i += DB_BATCH_SIZE) {
    const batch = allTransactions.slice(i, i + DB_BATCH_SIZE);

    await prisma.$transaction(async (tx) => {
      for (const trans of batch) {
        const transData = mapSleeperTransaction(trans);

        const transaction = await tx.transaction.upsert({
          where: { sleeperId: trans.transaction_id },
          update: transData,
          create: {
            sleeperId: trans.transaction_id,
            leagueId,
            ...transData,
          },
        });

        // Sync transaction players using pre-fetched maps
        if (trans.adds) {
          for (const [playerId, toRosterId] of Object.entries(trans.adds)) {
            const dbPlayerId = playerMap.get(playerId);
            if (!dbPlayerId) continue;

            const toDbRosterId = rosterMap.get(String(toRosterId));
            if (!toDbRosterId) continue;

            // Find from roster (for trades)
            let fromDbRosterId: string | null = null;
            if (trans.drops && trans.drops[playerId]) {
              fromDbRosterId = rosterMap.get(String(trans.drops[playerId])) || null;
            }

            await tx.transactionPlayer.upsert({
              where: {
                id: `${transaction.id}-${dbPlayerId}`,
              },
              update: {
                fromRosterId: fromDbRosterId,
                toRosterId: toDbRosterId,
              },
              create: {
                id: `${transaction.id}-${dbPlayerId}`,
                transactionId: transaction.id,
                playerId: dbPlayerId,
                fromRosterId: fromDbRosterId,
                toRosterId: toDbRosterId,
              },
            });
          }
        }

        count++;
      }
    });
  }

  return count;
}

// ============================================
// FAST SYNC (optimized for serverless timeouts)
// ============================================

/**
 * Fast sync - syncs league and rosters only
 * Skips: transactions (18 API calls), draft picks, traded picks
 * Use this for initial sync on Vercel serverless (10s limit)
 */
export async function syncLeagueFast(sleeperLeagueId: string): Promise<{
  league: { id: string; name: string };
  rosters: number;
  players: number;
}> {
  logger.info("Fast syncing league", { sleeperLeagueId });

  // Fetch essential league data in parallel
  const [leagueData, rosters, users] = await Promise.all([
    sleeper.getLeague(sleeperLeagueId),
    sleeper.getRosters(sleeperLeagueId),
    sleeper.getUsers(sleeperLeagueId),
  ]);

  // Find commissioner
  const commissionerSleeperUser = users.find((u) => u.is_owner);
  let commissionerId: string | null = null;
  if (commissionerSleeperUser) {
    const commissionerDbUser = await prisma.user.findUnique({
      where: { sleeperId: commissionerSleeperUser.user_id },
    });
    commissionerId = commissionerDbUser?.id || null;
  }

  // Upsert league
  const league = await prisma.league.upsert({
    where: { sleeperId: sleeperLeagueId },
    update: {
      ...mapSleeperLeague(leagueData),
      commissionerId,
      lastSyncedAt: new Date(),
    },
    create: {
      sleeperId: sleeperLeagueId,
      ...mapSleeperLeague(leagueData),
      commissionerId,
      lastSyncedAt: new Date(),
    },
  });

  // Ensure keeper settings exist
  await prisma.keeperSettings.upsert({
    where: { leagueId: league.id },
    update: {},
    create: {
      leagueId: league.id,
      ...DEFAULT_KEEPER_SETTINGS,
    },
  });

  const userMap = new Map(users.map((u) => [u.user_id, u]));

  // Batch fetch all players we need
  const allPlayerIds = new Set<string>();
  for (const roster of rosters) {
    roster.players?.forEach(id => allPlayerIds.add(id));
  }

  const existingPlayers = await prisma.player.findMany({
    where: { sleeperId: { in: Array.from(allPlayerIds) } },
    select: { id: true, sleeperId: true },
  });
  const playerMap = new Map(existingPlayers.map(p => [p.sleeperId, p.id]));

  let rosterCount = 0;
  let playerCount = 0;

  for (const roster of rosters) {
    const user = userMap.get(roster.owner_id);
    const rosterData = mapSleeperRoster(roster, user);

    const dbRoster = await prisma.roster.upsert({
      where: {
        leagueId_sleeperId: {
          leagueId: league.id,
          sleeperId: String(roster.roster_id),
        },
      },
      update: rosterData,
      create: {
        leagueId: league.id,
        sleeperId: String(roster.roster_id),
        ...rosterData,
      },
    });
    rosterCount++;

    // Link user to roster
    if (roster.owner_id) {
      const dbUser = await prisma.user.findUnique({
        where: { sleeperId: roster.owner_id },
      });
      if (dbUser) {
        await prisma.teamMember.upsert({
          where: { userId_rosterId: { userId: dbUser.id, rosterId: dbRoster.id } },
          update: {},
          create: { userId: dbUser.id, rosterId: dbRoster.id, role: "OWNER" },
        });
      }
    }

    // Batch sync roster players using createMany
    if (roster.players && roster.players.length > 0) {
      await prisma.rosterPlayer.deleteMany({ where: { rosterId: dbRoster.id } });

      const rosterPlayerData = roster.players
        .map(playerId => {
          const dbPlayerId = playerMap.get(playerId);
          if (!dbPlayerId) return null;
          return {
            rosterId: dbRoster.id,
            playerId: dbPlayerId,
            isStarter: roster.starters?.includes(playerId) || false,
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);

      if (rosterPlayerData.length > 0) {
        await prisma.rosterPlayer.createMany({ data: rosterPlayerData });
        playerCount += rosterPlayerData.length;
      }
    }
  }

  logger.info("Fast sync complete", { leagueName: league.name });
  return {
    league: { id: league.id, name: league.name },
    rosters: rosterCount,
    players: playerCount,
  };
}

/**
 * Fast sync all leagues for a user
 */
export async function syncUserLeaguesFast(
  userId: string,
  season: number
): Promise<{
  leagues: Array<{ id: string; name: string }>;
  totalRosters: number;
  totalPlayers: number;
}> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const sleeperLeagues = await sleeper.getUserLeagues(user.sleeperId, season);

  const results = {
    leagues: [] as Array<{ id: string; name: string }>,
    totalRosters: 0,
    totalPlayers: 0,
  };

  for (const league of sleeperLeagues) {
    const syncResult = await syncLeagueFast(league.league_id);
    results.leagues.push(syncResult.league);
    results.totalRosters += syncResult.rosters;
    results.totalPlayers += syncResult.players;
  }

  return results;
}

// ============================================
// FULL SYNC
// ============================================

/**
 * Perform a full sync for a user's leagues
 */
export async function syncUserLeagues(
  userId: string,
  season: number
): Promise<{
  leagues: Array<{ id: string; name: string }>;
  totalRosters: number;
  totalPlayers: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const sleeperLeagues = await sleeper.getUserLeagues(user.sleeperId, season);

  const results = {
    leagues: [] as Array<{ id: string; name: string }>,
    totalRosters: 0,
    totalPlayers: 0,
  };

  for (const league of sleeperLeagues) {
    const syncResult = await syncLeague(league.league_id);
    results.leagues.push(syncResult.league);
    results.totalRosters += syncResult.rosters;
    results.totalPlayers += syncResult.players;
  }

  return results;
}

/**
 * Quick sync - just update rosters for a league
 * Optimized with batch fetching to avoid N+1 queries
 */
export async function quickSyncLeague(leagueId: string): Promise<{
  rosters: number;
  players: number;
}> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
  });

  if (!league) {
    throw new Error("League not found");
  }

  const [rosters, users] = await Promise.all([
    sleeper.getRosters(league.sleeperId),
    sleeper.getUsers(league.sleeperId),
  ]);

  const userMap = new Map(users.map((u) => [u.user_id, u]));

  // Batch fetch all players we'll need (optimization: 1 query instead of N)
  const allPlayerIds = new Set<string>();
  for (const roster of rosters) {
    roster.players?.forEach(id => allPlayerIds.add(id));
  }

  const existingPlayers = await prisma.player.findMany({
    where: { sleeperId: { in: Array.from(allPlayerIds) } },
    select: { id: true, sleeperId: true },
  });
  const playerMap = new Map(existingPlayers.map(p => [p.sleeperId, p.id]));

  let rosterCount = 0;
  let playerCount = 0;

  // Use transaction for data consistency
  await prisma.$transaction(async (tx) => {
    for (const roster of rosters) {
      const user = userMap.get(roster.owner_id);
      const rosterData = mapSleeperRoster(roster, user);

      const dbRoster = await tx.roster.upsert({
        where: {
          leagueId_sleeperId: {
            leagueId: league.id,
            sleeperId: String(roster.roster_id),
          },
        },
        update: rosterData,
        create: {
          leagueId: league.id,
          sleeperId: String(roster.roster_id),
          ...rosterData,
        },
      });

      rosterCount++;

      // Update roster players using batch operations
      if (roster.players && roster.players.length > 0) {
        await tx.rosterPlayer.deleteMany({
          where: { rosterId: dbRoster.id },
        });

        // Build batch insert data using pre-fetched player map
        const rosterPlayerData = roster.players
          .map(playerId => {
            const dbPlayerId = playerMap.get(playerId);
            if (!dbPlayerId) return null;
            return {
              rosterId: dbRoster.id,
              playerId: dbPlayerId,
              isStarter: roster.starters?.includes(playerId) || false,
            };
          })
          .filter((d): d is NonNullable<typeof d> => d !== null);

        if (rosterPlayerData.length > 0) {
          await tx.rosterPlayer.createMany({ data: rosterPlayerData });
          playerCount += rosterPlayerData.length;
        }
      }
    }

    // Update last synced timestamp
    await tx.league.update({
      where: { id: leagueId },
      data: { lastSyncedAt: new Date() },
    });
  });

  return { rosters: rosterCount, players: playerCount };
}

// ============================================
// HISTORICAL SYNC
// ============================================

/**
 * Sync a league and all its historical seasons by following the previous_league_id chain
 */
export async function syncLeagueWithHistory(
  sleeperLeagueId: string,
  maxSeasons = MAX_HISTORICAL_SEASONS
): Promise<{
  seasons: Array<{ season: number; leagueId: string; name: string }>;
  totalTransactions: number;
}> {
  logger.info("Syncing league with history", { sleeperLeagueId, maxSeasons });

  const results = {
    seasons: [] as Array<{ season: number; leagueId: string; name: string }>,
    totalTransactions: 0,
  };

  let currentLeagueId: string | null = sleeperLeagueId;
  let seasonsProcessed = 0;

  while (currentLeagueId && seasonsProcessed < maxSeasons) {
    try {
      // Get league data from Sleeper
      const leagueData = await sleeper.getLeague(currentLeagueId);

      // Sync the league
      const syncResult = await syncLeague(currentLeagueId);

      // Count transactions
      const league = await prisma.league.findUnique({
        where: { sleeperId: currentLeagueId },
        include: { _count: { select: { transactions: true } } },
      });

      results.seasons.push({
        season: leagueData.season ? parseInt(leagueData.season) : 0,
        leagueId: syncResult.league.id,
        name: syncResult.league.name,
      });

      results.totalTransactions += league?._count.transactions || 0;

      logger.info("Synced historical season", {
        season: leagueData.season,
        leagueName: syncResult.league.name,
        draftPicks: syncResult.draftPicks,
      });

      // Move to previous season
      currentLeagueId = leagueData.previous_league_id || null;
      seasonsProcessed++;
    } catch (err) {
      logger.warn("Failed to sync historical league", {
        leagueId: currentLeagueId,
        error: err instanceof Error ? err.message : err,
      });
      break;
    }
  }

  logger.info("Historical sync complete", {
    seasons: results.seasons.length,
    totalTransactions: results.totalTransactions,
  });

  return results;
}

/**
 * Get all keeper history from database for a league chain
 */
export async function getKeeperHistoryFromDB(
  leagueId: string
): Promise<{
  seasons: number[];
  keeperCount: number;
}> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
  });

  if (!league) {
    throw new Error("League not found");
  }

  // Get all keepers for this league
  const keepers = await prisma.keeper.findMany({
    where: {
      roster: { leagueId },
    },
    select: { season: true },
  });

  const seasons = [...new Set(keepers.map((k) => k.season))].sort((a, b) => b - a);

  return {
    seasons,
    keeperCount: keepers.length,
  };
}

/**
 * Populate Keeper records from draft picks marked as keepers
 * This reconstructs historical keeper data from Sleeper's is_keeper flag
 */
export async function populateKeepersFromDraftPicks(
  leagueId: string
): Promise<{ created: number; skipped: number }> {
  // Get all draft picks marked as keepers for this league
  const keeperPicks = await prisma.draftPick.findMany({
    where: {
      isKeeper: true,
      playerId: { not: null },
      draft: {
        league: { id: leagueId },
      },
    },
    include: {
      draft: true,
      roster: true,
      player: true,
    },
    orderBy: {
      draft: { season: "asc" },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const pick of keeperPicks) {
    if (!pick.playerId || !pick.player || !pick.rosterId) continue;

    try {
    const season = pick.draft.season;

    // Count previous consecutive years this player was kept by this roster
    // This must be calculated FIRST, even for existing records
    const previousKeepers = await prisma.keeper.findMany({
      where: {
        playerId: pick.playerId,
        rosterId: pick.rosterId,
        season: { lt: season },
      },
      orderBy: { season: "desc" },
    });

    let consecutiveYears = 0;
    let checkSeason = season - 1;
    for (const keeper of previousKeepers) {
      if (keeper.season === checkSeason) {
        consecutiveYears++;
        checkSeason--;
      } else {
        break;
      }
    }

    const correctYearsKept = consecutiveYears + 1;

    // Check if Keeper record already exists
    const existingKeeper = await prisma.keeper.findFirst({
      where: {
        playerId: pick.playerId,
        rosterId: pick.rosterId,
        season: season,
      },
    });

    if (existingKeeper) {
      // Update yearsKept if it's incorrect
      if (existingKeeper.yearsKept !== correctYearsKept) {
        await prisma.keeper.update({
          where: { id: existingKeeper.id },
          data: {
            yearsKept: correctYearsKept,
            finalCost: Math.max(1, existingKeeper.baseCost - consecutiveYears),
          },
        });
        logger.debug("Updated keeper yearsKept", {
          player: pick.player?.fullName,
          oldYearsKept: existingKeeper.yearsKept,
          newYearsKept: correctYearsKept,
        });
      }
      skipped++;
      continue;
    }

    // Create Keeper record
    await prisma.keeper.create({
      data: {
        playerId: pick.playerId,
        rosterId: pick.rosterId,
        season: season,
        type: "REGULAR", // Default to regular keeper
        baseCost: pick.round,
        finalCost: Math.max(1, pick.round - consecutiveYears), // Cost improves each year
        yearsKept: correctYearsKept,
        acquisitionType: "DRAFTED",
        originalDraftRound: pick.round,
      },
    });

    created++;
    } catch (err) {
      logger.error("Error processing keeper pick", err, { player: pick.player?.fullName });
    }
  }

  logger.info("Populated keeper records from draft picks", { created, skipped });
  return { created, skipped };
}

/**
 * Recalculate yearsKept for all keepers in a league
 * This fixes any keepers that have incorrect yearsKept values
 */
export async function recalculateKeeperYears(
  leagueId: string
): Promise<{ updated: number; total: number }> {
  // Get all keepers for this league, ordered by player then season
  const keepers = await prisma.keeper.findMany({
    where: {
      roster: { leagueId },
    },
    include: {
      player: true,
      roster: true,
    },
    orderBy: [
      { playerId: "asc" },
      { rosterId: "asc" },
      { season: "asc" },
    ],
  });

  let updated = 0;

  // Process each keeper
  for (const keeper of keepers) {
    // Skip if player doesn't exist
    if (!keeper.player) {
      logger.warn("Keeper has no player, skipping", { keeperId: keeper.id });
      continue;
    }

    try {
      // Count previous consecutive years this player was kept by this roster
      const previousKeepers = await prisma.keeper.findMany({
        where: {
          playerId: keeper.playerId,
          rosterId: keeper.rosterId,
          season: { lt: keeper.season },
        },
        orderBy: { season: "desc" },
      });

      let consecutiveYears = 0;
      let checkSeason = keeper.season - 1;
      for (const prev of previousKeepers) {
        if (prev.season === checkSeason) {
          consecutiveYears++;
          checkSeason--;
        } else {
          break;
        }
      }

      const correctYearsKept = consecutiveYears + 1;

      // Update if different
      if (keeper.yearsKept !== correctYearsKept) {
        await prisma.keeper.update({
          where: { id: keeper.id },
          data: {
            yearsKept: correctYearsKept,
            finalCost: Math.max(1, keeper.baseCost - consecutiveYears),
          },
        });
        logger.debug("Fixed keeper yearsKept", {
          player: keeper.player.fullName,
          season: keeper.season,
          oldYearsKept: keeper.yearsKept,
          newYearsKept: correctYearsKept,
        });
        updated++;
      }
    } catch (err) {
      logger.error("Error processing keeper", err, { keeperId: keeper.id });
    }
  }

  logger.info("Recalculated keeper years", { updated, total: keepers.length });
  return { updated, total: keepers.length };
}
