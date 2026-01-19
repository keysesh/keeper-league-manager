import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { SleeperClient } from "./client";
import {
  mapSleeperPlayer,
  mapSleeperRoster,
  mapSleeperLeague,
  mapSleeperDraftStatus,
  mapSleeperTransaction,
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

    // Use owner_id as sleeperId to track same owner across seasons
    // Fall back to roster_id only if owner_id is not available (orphaned roster)
    const rosterSleeperId = roster.owner_id || String(roster.roster_id);

    const dbRoster = await prisma.roster.upsert({
      where: {
        leagueId_sleeperId: {
          leagueId: league.id,
          sleeperId: rosterSleeperId,
        },
      },
      update: rosterData,
      create: {
        leagueId: league.id,
        sleeperId: rosterSleeperId,
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

  // Sync traded picks - need to map roster_id (slot numbers) to owner_id (user IDs)
  // Build roster_id -> owner_id mapping
  const tradedPickRosterIdToOwnerId = new Map<number, string>();
  for (const roster of rosters) {
    if (roster.owner_id) {
      tradedPickRosterIdToOwnerId.set(roster.roster_id, roster.owner_id);
    }
  }

  for (const pick of tradedPicks) {
    // Sleeper traded picks use roster slot IDs, not owner user IDs
    // owner_id = original owner's roster_id, roster_id = current owner's roster_id
    const originalOwnerId = tradedPickRosterIdToOwnerId.get(pick.owner_id);
    const currentOwnerId = tradedPickRosterIdToOwnerId.get(pick.roster_id);

    if (!originalOwnerId || !currentOwnerId) {
      logger.warn("Could not map traded pick roster IDs", {
        pickOwnerSlot: pick.owner_id,
        pickRosterSlot: pick.roster_id,
        season: pick.season,
        round: pick.round,
      });
      continue;
    }

    await prisma.tradedPick.upsert({
      where: {
        leagueId_season_round_originalOwnerId: {
          leagueId: league.id,
          season: parseInt(pick.season),
          round: pick.round,
          originalOwnerId,
        },
      },
      update: {
        currentOwnerId,
      },
      create: {
        leagueId: league.id,
        season: parseInt(pick.season),
        round: pick.round,
        originalOwnerId,
        currentOwnerId,
      },
    });
  }

  // Sync drafts
  let draftPickCount = 0;
  for (const draft of drafts) {
    try {
      draftPickCount += await syncDraft(league.id, draft, rosters);
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
async function syncDraft(
  leagueId: string,
  draftData: {
    draft_id: string;
    season: string;
    status: string;
    type: string;
    start_time?: number | null;
    settings?: Record<string, unknown> | null;
    slot_to_roster_id?: Record<string, number> | null;
  },
  sleeperRosters: Array<{ roster_id: number; owner_id: string }>
): Promise<number> {
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

  // Build roster_id -> owner_id mapping from Sleeper rosters
  const rosterIdToOwnerId = new Map<number, string>();
  for (const roster of sleeperRosters) {
    if (roster.owner_id) {
      rosterIdToOwnerId.set(roster.roster_id, roster.owner_id);
    }
  }

  // Batch fetch all DB rosters for this league (keyed by owner_id / sleeperId)
  const dbRosters = await prisma.roster.findMany({
    where: { leagueId },
    select: { id: true, sleeperId: true },
  });
  const ownerIdToDbRosterId = new Map(dbRosters.map(r => [r.sleeperId, r.id]));

  // Build roster_id (slot) -> DB roster ID mapping
  const slotToDbRosterId = new Map<number, string>();
  for (const [rosterIdNum, ownerId] of rosterIdToOwnerId) {
    const dbRosterId = ownerIdToDbRosterId.get(ownerId);
    if (dbRosterId) {
      slotToDbRosterId.set(rosterIdNum, dbRosterId);
    }
  }

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
    // pick.roster_id is a slot number (1-10), map to DB roster ID
    const rosterId = slotToDbRosterId.get(parseInt(pick.roster_id));
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

  // Fetch Sleeper rosters to build roster_id -> owner_id mapping
  // Sleeper transactions use roster_id (1-10), but our DB uses owner_id
  const sleeperRosters = await sleeper.getRosters(league.sleeperId);
  const rosterIdToOwnerId = new Map<number, string>();
  for (const roster of sleeperRosters) {
    if (roster.owner_id) {
      rosterIdToOwnerId.set(roster.roster_id, roster.owner_id);
    }
  }

  const allTransactions = await sleeper.getAllTransactions(league.sleeperId);

  if (allTransactions.length === 0) {
    return 0;
  }

  // Batch fetch all players and rosters we'll need (optimization: 2 queries instead of N*3)
  const allPlayerIds = new Set<string>();
  const allOwnerIds = new Set<string>();

  for (const trans of allTransactions) {
    if (trans.adds) {
      Object.keys(trans.adds).forEach(id => allPlayerIds.add(id));
      // Convert roster_id to owner_id for lookup
      Object.values(trans.adds).forEach(rosterIdNum => {
        const ownerId = rosterIdToOwnerId.get(rosterIdNum);
        if (ownerId) allOwnerIds.add(ownerId);
      });
    }
    if (trans.drops) {
      Object.keys(trans.drops).forEach(id => allPlayerIds.add(id));
      // Convert roster_id to owner_id for lookup
      Object.values(trans.drops).forEach(rosterIdNum => {
        const ownerId = rosterIdToOwnerId.get(rosterIdNum);
        if (ownerId) allOwnerIds.add(ownerId);
      });
    }
  }

  const [players, rosters] = await Promise.all([
    prisma.player.findMany({
      where: { sleeperId: { in: Array.from(allPlayerIds) } },
      select: { id: true, sleeperId: true },
    }),
    prisma.roster.findMany({
      where: { leagueId, sleeperId: { in: Array.from(allOwnerIds) } },
      select: { id: true, sleeperId: true },
    }),
  ]);

  const playerMap = new Map(players.map(p => [p.sleeperId, p.id]));
  // Map owner_id (sleeperId in our DB) to database roster ID
  const rosterMap = new Map(rosters.map(r => [r.sleeperId, r.id]));

  let count = 0;

  // Process transactions in batches with extended timeout for large syncs
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
        // Process adds (pickups, trades where player is acquired)
        if (trans.adds) {
          for (const [playerId, toRosterIdNum] of Object.entries(trans.adds)) {
            const dbPlayerId = playerMap.get(playerId);
            if (!dbPlayerId) continue;

            // Convert roster_id to owner_id, then look up DB roster
            const toOwnerId = rosterIdToOwnerId.get(toRosterIdNum);
            if (!toOwnerId) continue;
            const toDbRosterId = rosterMap.get(toOwnerId);
            if (!toDbRosterId) continue;

            // Find from roster (for trades)
            let fromDbRosterId: string | null = null;
            if (trans.drops && trans.drops[playerId]) {
              const fromOwnerId = rosterIdToOwnerId.get(trans.drops[playerId]);
              if (fromOwnerId) {
                fromDbRosterId = rosterMap.get(fromOwnerId) || null;
              }
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

        // Process standalone drops (drops without corresponding adds)
        // These are players dropped to waivers/FA without being picked up
        if (trans.drops) {
          for (const [playerId, fromRosterIdNum] of Object.entries(trans.drops)) {
            // Skip if this drop was part of an add (already processed above)
            if (trans.adds && playerId in trans.adds) {
              continue;
            }

            const dbPlayerId = playerMap.get(playerId);
            if (!dbPlayerId) continue;

            // Convert roster_id to owner_id, then look up DB roster
            const fromOwnerId = rosterIdToOwnerId.get(fromRosterIdNum);
            if (!fromOwnerId) continue;
            const fromDbRosterId = rosterMap.get(fromOwnerId);
            if (!fromDbRosterId) continue;

            // Standalone drop: fromRosterId is set, toRosterId is null
            await tx.transactionPlayer.upsert({
              where: {
                id: `${transaction.id}-${dbPlayerId}`,
              },
              update: {
                fromRosterId: fromDbRosterId,
                toRosterId: null,
              },
              create: {
                id: `${transaction.id}-${dbPlayerId}`,
                transactionId: transaction.id,
                playerId: dbPlayerId,
                fromRosterId: fromDbRosterId,
                toRosterId: null,
              },
            });
          }
        }

        count++;
      }
    }, { timeout: 60000 }); // 60 second timeout for large transaction batches
  }

  return count;
}

// ============================================
// PLAYER OWNERSHIP HISTORY
// ============================================

interface OwnershipPeriod {
  rosterId: string;
  rosterSleeperId: string;
  startDate: Date;
  endDate: Date | null; // null = still owned
  acquisitionType: "DRAFT" | "TRADE" | "WAIVER" | "FREE_AGENT";
  season: number;
}

/**
 * Build complete ownership history for a player in a league
 * Uses transactions and draft picks to track all ownership changes
 *
 * IMPORTANT: Only uses ORIGINAL draft picks (not keeper picks) for initial ownership.
 * Keeper picks confirm continued ownership, they don't start new ownership periods.
 */
export async function buildPlayerOwnershipHistory(
  playerId: string,
  leagueId: string
): Promise<OwnershipPeriod[]> {
  // Get league chain (current + historical seasons)
  const leagueChain = await getLeagueChainForSync(leagueId);

  // Get all relevant data in batch
  const [transactions, draftPicks, rosters] = await Promise.all([
    prisma.transactionPlayer.findMany({
      where: {
        playerId,
        transaction: { leagueId: { in: leagueChain } },
      },
      include: {
        transaction: true,
      },
      orderBy: { transaction: { createdAt: "asc" } },
    }),
    prisma.draftPick.findMany({
      where: {
        playerId,
        draft: { leagueId: { in: leagueChain } },
        // Only get original draft (non-keeper picks)
        isKeeper: false,
      },
      include: {
        draft: true,
        roster: true,
      },
      orderBy: { draft: { season: "asc" } },
    }),
    prisma.roster.findMany({
      where: { leagueId: { in: leagueChain } },
      select: { id: true, sleeperId: true, leagueId: true },
    }),
  ]);

  const rosterMap = new Map(rosters.map(r => [r.id, r]));
  const periods: OwnershipPeriod[] = [];

  // Process ONLY original draft pick (first non-keeper draft)
  // There should only be one original draft per player
  const originalDraft = draftPicks[0];
  if (originalDraft?.rosterId && originalDraft?.roster) {
    periods.push({
      rosterId: originalDraft.rosterId,
      rosterSleeperId: originalDraft.roster.sleeperId,
      startDate: new Date(originalDraft.draft.season, 7, 1), // August of draft year
      endDate: null,
      acquisitionType: "DRAFT",
      season: originalDraft.draft.season,
    });
  }

  // Process transactions (trades, waivers, FA)
  for (const tp of transactions) {
    const txDate = tp.transaction.createdAt;
    const txSeason = txDate.getMonth() >= 2 ? txDate.getFullYear() : txDate.getFullYear() - 1;

    // If player was added to a roster (trade in, waiver claim, FA pickup)
    if (tp.toRosterId) {
      const roster = rosterMap.get(tp.toRosterId);
      if (!roster) continue;

      // Close previous ownership period
      const lastPeriod = periods[periods.length - 1];
      if (lastPeriod && !lastPeriod.endDate) {
        lastPeriod.endDate = txDate;
      }

      // Start new ownership period
      let acqType: OwnershipPeriod["acquisitionType"] = "FREE_AGENT";
      if (tp.transaction.type === "TRADE") acqType = "TRADE";
      else if (tp.transaction.type === "WAIVER") acqType = "WAIVER";

      periods.push({
        rosterId: tp.toRosterId,
        rosterSleeperId: roster.sleeperId,
        startDate: txDate,
        endDate: null,
        acquisitionType: acqType,
        season: txSeason,
      });
    }
    // If player was dropped (no toRosterId)
    else if (tp.fromRosterId && !tp.toRosterId) {
      const lastPeriod = periods[periods.length - 1];
      if (lastPeriod && lastPeriod.rosterId === tp.fromRosterId && !lastPeriod.endDate) {
        lastPeriod.endDate = txDate;
      }
    }
  }

  return periods;
}

/**
 * Determine who owned a player at a specific point in time
 */
export async function getPlayerOwnerAtDate(
  playerId: string,
  leagueId: string,
  date: Date
): Promise<{ rosterId: string; rosterSleeperId: string } | null> {
  const history = await buildPlayerOwnershipHistory(playerId, leagueId);

  for (const period of history.reverse()) {
    const endDate = period.endDate || new Date();
    if (date >= period.startDate && date <= endDate) {
      return { rosterId: period.rosterId, rosterSleeperId: period.rosterSleeperId };
    }
  }

  return null;
}

/**
 * Check if a player was owned by the same roster at end of previous season
 * Used to determine if keeper years should continue or reset
 *
 * Trade deadline considerations:
 * - Before deadline: Player must have been on roster at previous season end
 * - After deadline (offseason): Years always reset for new owner
 */
export async function wasOwnedAtSeasonEnd(
  playerId: string,
  leagueId: string,
  currentRosterSleeperId: string,
  previousSeason: number
): Promise<boolean> {
  const history = await buildPlayerOwnershipHistory(playerId, leagueId);

  // Find ownership at end of previous season (roughly February of next year)
  const seasonEndDate = new Date(previousSeason + 1, 1, 28); // Feb 28 of following year

  for (const period of history) {
    const endDate = period.endDate || new Date();
    if (period.startDate <= seasonEndDate && endDate >= seasonEndDate) {
      return period.rosterSleeperId === currentRosterSleeperId;
    }
  }

  return false;
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

    // Use owner_id as sleeperId to track same owner across seasons
    const rosterSleeperId = roster.owner_id || String(roster.roster_id);

    const dbRoster = await prisma.roster.upsert({
      where: {
        leagueId_sleeperId: {
          leagueId: league.id,
          sleeperId: rosterSleeperId,
        },
      },
      update: rosterData,
      create: {
        leagueId: league.id,
        sleeperId: rosterSleeperId,
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

      // Use owner_id as sleeperId to track same owner across seasons
      const rosterSleeperId = roster.owner_id || String(roster.roster_id);

      const dbRoster = await tx.roster.upsert({
        where: {
          leagueId_sleeperId: {
            leagueId: league.id,
            sleeperId: rosterSleeperId,
          },
        },
        update: rosterData,
        create: {
          leagueId: league.id,
          sleeperId: rosterSleeperId,
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
 *
 * IMPORTANT: Uses transaction history to properly handle trades:
 * - If player was traded to new owner, years reset to 1
 * - If player was on same roster at end of previous season, years continue
 *
 * IMPORTANT: Handles draft/drop/re-draft scenarios:
 * - When a player is drafted, dropped, then re-drafted in the same draft,
 *   Sleeper may mark the FIRST pick as isKeeper=true even though the player
 *   ended up on a different roster.
 * - This function finds the LAST pick for each player to determine the correct owner.
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
    if (!pick.playerId || !pick.player || !pick.rosterId || !pick.roster) continue;

    try {
    const season = pick.draft.season;

    // FIX: Check if this player was drafted multiple times in this SEASON (draft/drop/re-draft)
    // Query by season, not draftId, because there may be multiple drafts per season
    // If so, use the LAST pick's roster as the correct owner
    const allPicksForPlayer = await prisma.draftPick.findMany({
      where: {
        playerId: pick.playerId,
        draft: {
          season: season,
          leagueId: leagueId,
        },
      },
      include: {
        roster: true,
      },
      orderBy: {
        pickNumber: "asc",
      },
    });

    // Use the LAST pick's roster as the actual owner (they ended up with the player)
    const finalPick = allPicksForPlayer[allPicksForPlayer.length - 1];
    const correctRoster = finalPick?.roster || pick.roster;
    const correctRosterId = finalPick?.rosterId || pick.rosterId;
    const rosterSleeperId = correctRoster.sleeperId;

    // Log if there's a mismatch (for debugging)
    if (allPicksForPlayer.length > 1 && finalPick?.rosterId !== pick.rosterId) {
      logger.info("Keeper pick mismatch detected - using final owner", {
        player: pick.player?.fullName,
        season,
        originalRoster: pick.roster.teamName,
        correctRoster: correctRoster.teamName,
        pickCount: allPicksForPlayer.length,
      });
    }

    // Check if player was owned by this roster at end of previous season
    // This uses transaction history to account for trades
    const ownedAtPrevSeasonEnd = await wasOwnedAtSeasonEnd(
      pick.playerId,
      leagueId,
      rosterSleeperId,
      season - 1
    );

    let consecutiveYears = 0;

    if (ownedAtPrevSeasonEnd) {
      // Player was on this roster last season - check for consecutive years
      const previousKeepers = await prisma.keeper.findMany({
        where: {
          playerId: pick.playerId,
          roster: { sleeperId: rosterSleeperId },
          season: { lt: season },
        },
        orderBy: { season: "desc" },
      });

      let checkSeason = season - 1;
      for (const keeper of previousKeepers) {
        if (keeper.season === checkSeason) {
          consecutiveYears++;
          checkSeason--;
        } else {
          break;
        }
      }
    }
    // If not owned at previous season end, consecutiveYears stays 0 (years reset)

    const correctYearsKept = consecutiveYears + 1;

    // Check if Keeper record already exists for the CORRECT roster
    const existingKeeper = await prisma.keeper.findFirst({
      where: {
        playerId: pick.playerId,
        rosterId: correctRosterId,
        season: season,
      },
    });

    // Also check for a keeper on the WRONG roster (draft/drop/re-draft fix)
    const wrongRosterKeeper = correctRosterId !== pick.rosterId
      ? await prisma.keeper.findFirst({
          where: {
            playerId: pick.playerId,
            rosterId: pick.rosterId,
            season: season,
          },
        })
      : null;

    // Fix wrong roster keeper by moving it to correct roster
    if (wrongRosterKeeper) {
      await prisma.keeper.update({
        where: { id: wrongRosterKeeper.id },
        data: {
          rosterId: correctRosterId,
          yearsKept: correctYearsKept,
          finalCost: Math.max(1, wrongRosterKeeper.baseCost - consecutiveYears),
        },
      });
      logger.info("Fixed keeper roster assignment", {
        player: pick.player?.fullName,
        season,
        oldRoster: pick.roster.teamName,
        newRoster: correctRoster.teamName,
      });
      skipped++;
      continue;
    }

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

    // Create Keeper record with CORRECT roster
    await prisma.keeper.create({
      data: {
        playerId: pick.playerId,
        rosterId: correctRosterId,
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
 * Get all league IDs in the historical chain (current + all previous seasons)
 */
async function getLeagueChainForSync(startLeagueId: string): Promise<string[]> {
  const leagueIds: string[] = [];

  async function addToChain(leagueId: string, depth: number): Promise<void> {
    if (depth >= 10) return;

    leagueIds.push(leagueId);

    const leagueData = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { previousLeagueId: true },
    });

    if (!leagueData?.previousLeagueId) return;

    const prevLeague = await prisma.league.findUnique({
      where: { sleeperId: leagueData.previousLeagueId },
      select: { id: true },
    });

    if (prevLeague?.id) {
      await addToChain(prevLeague.id, depth + 1);
    }
  }

  await addToChain(startLeagueId, 0);
  return leagueIds;
}

/**
 * Recalculate yearsKept for all keepers in a league
 * Uses transaction history to properly handle trades:
 * - If player was traded to current owner, years reset to 1
 * - If player was continuously owned by same roster, years continue
 */
export async function recalculateKeeperYears(
  leagueId: string
): Promise<{ updated: number; total: number }> {
  // Get all leagues in the chain
  const leagueChain = await getLeagueChainForSync(leagueId);

  // Get all rosters across the chain, mapped by sleeperId for cross-season matching
  const allRosters = await prisma.roster.findMany({
    where: { leagueId: { in: leagueChain } },
    select: { id: true, sleeperId: true, leagueId: true },
  });

  // Map roster sleeperId to all roster IDs for that team across seasons
  const rosterChainMap = new Map<string, string[]>();
  for (const roster of allRosters) {
    if (!rosterChainMap.has(roster.sleeperId)) {
      rosterChainMap.set(roster.sleeperId, []);
    }
    rosterChainMap.get(roster.sleeperId)!.push(roster.id);
  }

  // Get all keepers for this specific league (not the chain)
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
      { season: "asc" },
    ],
  });

  let updated = 0;

  // Process each keeper
  for (const keeper of keepers) {
    if (!keeper.player) {
      logger.warn("Keeper has no player, skipping", { keeperId: keeper.id });
      continue;
    }

    try {
      const rosterSleeperId = keeper.roster.sleeperId;
      const teamRosterIds = rosterChainMap.get(rosterSleeperId) || [keeper.rosterId];

      // FIX: Merge keeper years from BOTH Keeper table AND isKeeper draft picks
      // This ensures we count all historical keeper seasons, not just those in the Keeper table

      // 1. Get seasons from Keeper table for this team
      const previousKeepers = await prisma.keeper.findMany({
        where: {
          playerId: keeper.playerId,
          rosterId: { in: teamRosterIds },
          season: { lt: keeper.season },
        },
      });
      const keeperSeasons = new Set(previousKeepers.map(k => k.season));

      // 2. Get seasons from draft picks marked as keepers for this team
      const keeperPicks = await prisma.draftPick.findMany({
        where: {
          playerId: keeper.playerId,
          isKeeper: true,
          rosterId: { in: teamRosterIds },
          draft: { season: { lt: keeper.season } },
        },
        include: { draft: { select: { season: true } } },
      });
      for (const pick of keeperPicks) {
        keeperSeasons.add(pick.draft.season);
      }

      // 3. Count unique past keeper seasons
      const pastKeeperCount = keeperSeasons.size;
      const correctYearsKept = pastKeeperCount + 1;

      // Update if different
      const correctFinalCost = Math.max(1, keeper.baseCost - pastKeeperCount);
      if (keeper.yearsKept !== correctYearsKept || keeper.finalCost !== correctFinalCost) {
        await prisma.keeper.update({
          where: { id: keeper.id },
          data: {
            yearsKept: correctYearsKept,
            finalCost: correctFinalCost,
          },
        });
        logger.info("Fixed keeper yearsKept", {
          player: keeper.player.fullName,
          season: keeper.season,
          oldYearsKept: keeper.yearsKept,
          newYearsKept: correctYearsKept,
          oldFinalCost: keeper.finalCost,
          newFinalCost: correctFinalCost,
          pastKeeperSeasons: Array.from(keeperSeasons),
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
