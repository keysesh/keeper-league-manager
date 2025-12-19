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

  // Upsert league
  const league = await prisma.league.upsert({
    where: { sleeperId: sleeperLeagueId },
    update: {
      ...mapSleeperLeague(leagueData),
      lastSyncedAt: new Date(),
    },
    create: {
      sleeperId: sleeperLeagueId,
      ...mapSleeperLeague(leagueData),
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

    // Sync roster players
    if (roster.players && roster.players.length > 0) {
      // Clear existing roster players
      await prisma.rosterPlayer.deleteMany({
        where: { rosterId: dbRoster.id },
      });

      // Add current players
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
      rounds: draftData.settings?.rounds || 16,
      draftOrder: draftData.slot_to_roster_id
        ? (draftData.slot_to_roster_id as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      settings: draftData.settings
        ? (draftData.settings as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });

  // Sync draft picks
  let pickCount = 0;
  for (const pick of picks) {
    // Find roster by sleeper roster_id
    const roster = await prisma.roster.findUnique({
      where: {
        leagueId_sleeperId: {
          leagueId,
          sleeperId: String(pick.roster_id),
        },
      },
    });

    if (!roster) continue;

    // Find player if drafted
    let playerId: string | null = null;
    if (pick.player_id) {
      const player = await prisma.player.findUnique({
        where: { sleeperId: pick.player_id },
      });
      playerId = player?.id || null;
    }

    await prisma.draftPick.upsert({
      where: {
        draftId_round_draftSlot: {
          draftId: draft.id,
          round: pick.round,
          draftSlot: pick.draft_slot,
        },
      },
      update: {
        rosterId: roster.id,
        playerId,
        pickNumber: pick.pick_no,
        metadata: pick.metadata
          ? (pick.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      create: {
        draftId: draft.id,
        rosterId: roster.id,
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
