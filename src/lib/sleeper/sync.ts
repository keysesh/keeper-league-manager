import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { SleeperClient } from "./client";
import {
  mapSleeperPlayer,
  mapSleeperRoster,
  mapSleeperLeague,
  mapSleeperLeagueStatus,
  mapSleeperDraftStatus,
  mapSleeperTransaction,
  mapSleeperTransactionType,
  mapSleeperTradedPick,
} from "./mappers";

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
  console.log("Starting player sync...");
  const players = await sleeper.getAllPlayers();
  const playerEntries = Object.entries(players);

  let created = 0;
  let updated = 0;

  // Process in batches of 100 for performance
  const batchSize = 100;
  for (let i = 0; i < playerEntries.length; i += batchSize) {
    const batch = playerEntries.slice(i, i + batchSize);

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

    // Log progress every 1000 players
    if ((i + batchSize) % 1000 === 0) {
      console.log(`Processed ${i + batchSize} / ${playerEntries.length} players`);
    }
  }

  console.log(`Player sync complete: ${playerEntries.length} players processed`);
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
  console.log(`Syncing league ${sleeperLeagueId}...`);

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
      maxKeepers: 7,
      maxFranchiseTags: 2,
      maxRegularKeepers: 5,
      regularKeeperMaxYears: 2,
      undraftedRound: 8,
      minimumRound: 1,
      costReductionPerYear: 1,
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
      console.warn(`Failed to sync draft ${draft.draft_id}:`, err);
    }
  }

  // Sync transactions (waivers, trades, FA pickups)
  try {
    const transactionCount = await syncTransactions(league.id);
    console.log(`Synced ${transactionCount} transactions for ${league.name}`);
  } catch (err) {
    console.warn(`Failed to sync transactions for ${league.name}:`, err);
  }

  console.log(`League sync complete: ${league.name}`);
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
      rounds: typeof draftData.settings?.rounds === 'number' ? draftData.settings.rounds : 16,
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
 */
export async function syncTransactions(leagueId: string): Promise<number> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
  });

  if (!league) {
    throw new Error("League not found");
  }

  const allTransactions = await sleeper.getAllTransactions(league.sleeperId);
  let count = 0;

  for (const trans of allTransactions) {
    const transData = mapSleeperTransaction(trans);

    const transaction = await prisma.transaction.upsert({
      where: { sleeperId: trans.transaction_id },
      update: transData,
      create: {
        sleeperId: trans.transaction_id,
        leagueId,
        ...transData,
      },
    });

    // Sync transaction players
    if (trans.adds) {
      for (const [playerId, toRosterId] of Object.entries(trans.adds)) {
        const player = await prisma.player.findUnique({
          where: { sleeperId: playerId },
        });

        if (!player) continue;

        // Find from roster (for trades)
        let fromRosterId: string | null = null;
        if (trans.drops && trans.drops[playerId]) {
          const fromRoster = await prisma.roster.findUnique({
            where: {
              leagueId_sleeperId: {
                leagueId,
                sleeperId: String(trans.drops[playerId]),
              },
            },
          });
          fromRosterId = fromRoster?.id || null;
        }

        const toRoster = await prisma.roster.findUnique({
          where: {
            leagueId_sleeperId: {
              leagueId,
              sleeperId: String(toRosterId),
            },
          },
        });

        if (toRoster) {
          await prisma.transactionPlayer.upsert({
            where: {
              id: `${transaction.id}-${player.id}`,
            },
            update: {
              fromRosterId,
              toRosterId: toRoster.id,
            },
            create: {
              id: `${transaction.id}-${player.id}`,
              transactionId: transaction.id,
              playerId: player.id,
              fromRosterId,
              toRosterId: toRoster.id,
            },
          });
        }
      }
    }

    count++;
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
  console.log(`Fast syncing league ${sleeperLeagueId}...`);

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
      maxKeepers: 7,
      maxFranchiseTags: 2,
      maxRegularKeepers: 5,
      regularKeeperMaxYears: 2,
      undraftedRound: 8,
      minimumRound: 1,
      costReductionPerYear: 1,
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

  console.log(`Fast sync complete: ${league.name}`);
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

    // Update roster players
    if (roster.players) {
      await prisma.rosterPlayer.deleteMany({
        where: { rosterId: dbRoster.id },
      });

      for (const playerId of roster.players) {
        const player = await prisma.player.findUnique({
          where: { sleeperId: playerId },
        });

        if (player) {
          await prisma.rosterPlayer.create({
            data: {
              rosterId: dbRoster.id,
              playerId: player.id,
              isStarter: roster.starters?.includes(playerId) || false,
            },
          });
          playerCount++;
        }
      }
    }
  }

  // Update last synced timestamp
  await prisma.league.update({
    where: { id: leagueId },
    data: { lastSyncedAt: new Date() },
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
  maxSeasons = 10
): Promise<{
  seasons: Array<{ season: number; leagueId: string; name: string }>;
  totalTransactions: number;
}> {
  console.log(`Syncing league ${sleeperLeagueId} with history...`);

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

      console.log(
        `Synced ${leagueData.season} season: ${syncResult.league.name} (${syncResult.draftPicks} draft picks)`
      );

      // Move to previous season
      currentLeagueId = leagueData.previous_league_id || null;
      seasonsProcessed++;
    } catch (err) {
      console.warn(`Failed to sync historical league ${currentLeagueId}:`, err);
      break;
    }
  }

  console.log(
    `Historical sync complete: ${results.seasons.length} seasons, ${results.totalTransactions} total transactions`
  );

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
