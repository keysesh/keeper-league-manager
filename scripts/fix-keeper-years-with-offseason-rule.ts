/**
 * Fix Keeper Years with Proper Offseason Trade Rule
 *
 * OFFSEASON TRADE RULE:
 * - If a player is traded DURING the offseason (after trade deadline through August),
 *   their keeper years reset to 1 for the new owner
 * - Offseason is defined as: December of previous year through August of current year
 *
 * ALGORITHM:
 * 1. For each keeper record, find all transactions for that player
 * 2. Determine if the current owner acquired the player via offseason trade
 * 3. If offseason trade: years = 1 for that season
 * 4. If same owner continuously: years = previous year + 1
 * 5. Cascade forward to fix all subsequent years
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface KeeperWithDetails {
  id: string;
  playerId: string;
  rosterId: string;
  season: number;
  yearsKept: number;
  baseCost: number;
  finalCost: number;
  type: string;
  player: { fullName: string; sleeperId: string };
  roster: { sleeperId: string; teamName: string };
}

interface TransactionInfo {
  id: string;
  type: string;
  createdAt: Date;
  date: Date;
  toRosterId: string | null;
  toRosterSleeperId: string | null;
  fromRosterId: string | null;
  fromRosterSleeperId: string | null;
  // Full trade details
  allPlayersInTrade: Array<{
    playerName: string;
    fromSleeperId: string | null;
    toSleeperId: string | null;
  }>;
}

/**
 * Check if a trade affects a given keeper season (should reset years)
 *
 * OFFSEASON TRADE RULE:
 * - Fantasy season N runs ~Sept N through Feb N+1
 * - Keeper drafts happen in ~Aug-Sept before the season
 * - A trade that happens AFTER the previous season's keeper draft and BEFORE
 *   the current season's keeper draft is an "offseason trade" that resets years
 *
 * For a 2025 keeper, offseason trades are:
 * - After 2024 draft (~Sept 2024 draft is complete)
 * - Before 2025 draft (~Sept 2025)
 * - So roughly: Oct 2024 through Aug 2025
 *
 * But wait - if the 2024 keeper was already kept, and THEN traded in Aug 2024
 * (before the 2024 season started), that trade affects the 2025 keeper.
 *
 * Simplified rule: If the trade happened after the keeper's previous season's
 * keeper record was created (roughly the draft date of prev season), it's offseason.
 */
function isOffseasonTradeForKeeper(tradeDate: Date, keeperSeason: number): boolean {
  const month = tradeDate.getMonth(); // 0-indexed (0 = Jan, 11 = Dec)
  const year = tradeDate.getFullYear();

  // For keeper season N, offseason trades are:
  // - After Sept of year N-1 (when N-1 draft/season completes lineup decisions)
  // - Through Aug of year N (before the N draft)
  //
  // So for 2025 keeper:
  // - Trades from Oct 2024 through Aug 2025 are offseason trades
  // - Sept 2024 trades could be either (depends on draft date)
  //
  // Simplified: Any trade from Sept N-1 through Aug N resets years for season N keeper

  // Trade in Sept-Dec of previous year (N-1)
  if (year === keeperSeason - 1 && month >= 8) {
    return true;
  }

  // Trade in Jan-Aug of keeper year (N)
  if (year === keeperSeason && month <= 7) {
    return true;
  }

  return false;
}

/**
 * Get the season that a date falls into (for in-season determination)
 * Sept-Feb = that year's season (Sept-Dec) or previous year's season (Jan-Feb)
 */
function getSeasonForDate(date: Date): number {
  const month = date.getMonth();
  const year = date.getFullYear();

  // Sept (8) through Dec (11) = current year's season
  if (month >= 8) {
    return year;
  }

  // Jan (0) through Aug (7) = previous year's season (offseason)
  // But for classification, consider it the upcoming year's offseason
  return year;
}

async function getPlayerTransactions(
  playerId: string,
  leagueIds: string[],
  rosterMap: Map<string, string> // rosterId -> sleeperId
): Promise<TransactionInfo[]> {
  const transactionPlayers = await prisma.transactionPlayer.findMany({
    where: {
      playerId,
      transaction: {
        leagueId: { in: leagueIds },
        type: "TRADE", // Only care about trades for offseason rule
      },
    },
    include: {
      transaction: {
        include: {
          players: {
            include: {
              player: { select: { fullName: true } },
            },
          },
        },
      },
    },
    orderBy: {
      transaction: { createdAt: "asc" },
    },
  });

  return transactionPlayers.map((tp) => ({
    id: tp.transaction.id,
    type: tp.transaction.type,
    createdAt: tp.transaction.createdAt,
    date: tp.transaction.createdAt,
    toRosterId: tp.toRosterId,
    toRosterSleeperId: tp.toRosterId ? rosterMap.get(tp.toRosterId) || null : null,
    fromRosterId: tp.fromRosterId,
    fromRosterSleeperId: tp.fromRosterId ? rosterMap.get(tp.fromRosterId) || null : null,
    allPlayersInTrade: tp.transaction.players.map((p) => ({
      playerName: p.player?.fullName || "Unknown",
      fromSleeperId: p.fromRosterId ? rosterMap.get(p.fromRosterId) || null : null,
      toSleeperId: p.toRosterId ? rosterMap.get(p.toRosterId) || null : null,
    })),
  }));
}

async function getLeagueChain(startLeagueId: string): Promise<string[]> {
  const leagueIds: string[] = [];
  let currentId: string | null = startLeagueId;
  let depth = 0;

  while (currentId && depth < 10) {
    leagueIds.push(currentId);
    const leagueData: { previousLeagueId: string | null } | null = await prisma.league.findUnique({
      where: { id: currentId },
      select: { previousLeagueId: true },
    });

    if (!leagueData?.previousLeagueId) break;

    const prevLeague: { id: string } | null = await prisma.league.findUnique({
      where: { sleeperId: leagueData.previousLeagueId },
      select: { id: true },
    });

    currentId = prevLeague?.id || null;
    depth++;
  }

  return leagueIds;
}

async function getOriginalDraft(
  playerId: string,
  leagueIds: string[]
): Promise<{ rosterId: string; rosterSleeperId: string; season: number; round: number } | null> {
  const draftPick = await prisma.draftPick.findFirst({
    where: {
      playerId,
      isKeeper: false, // Original draft, not a keeper pick
      draft: { leagueId: { in: leagueIds } },
    },
    include: {
      draft: true,
      roster: { select: { sleeperId: true } },
    },
    orderBy: {
      draft: { season: "asc" },
    },
  });

  if (!draftPick?.rosterId || !draftPick?.roster) return null;

  return {
    rosterId: draftPick.rosterId,
    rosterSleeperId: draftPick.roster.sleeperId,
    season: draftPick.draft.season,
    round: draftPick.round,
  };
}

async function fixKeeperYears(leagueId: string, playerSleeperId?: string) {
  console.log("=".repeat(60));
  console.log("FIX KEEPER YEARS WITH OFFSEASON TRADE RULE");
  console.log("=".repeat(60));

  // Get league chain
  const leagueIds = await getLeagueChain(leagueId);
  console.log(`\nLeague chain: ${leagueIds.length} seasons`);

  // Build roster maps for all leagues
  const allRosters = await prisma.roster.findMany({
    where: { leagueId: { in: leagueIds } },
    select: { id: true, sleeperId: true, teamName: true },
  });
  const rosterMap = new Map<string, string>(allRosters.map((r) => [r.id, r.sleeperId]));
  // Build sleeperId -> teamName map (use most recent team name for each sleeperId)
  const sleeperIdToTeamName = new Map<string, string>();
  for (const r of allRosters) {
    if (r.teamName) {
      sleeperIdToTeamName.set(r.sleeperId, r.teamName);
    }
  }
  console.log(`Loaded ${rosterMap.size} rosters for roster ID lookup`);

  // Get all keepers (optionally filtered by player)
  const whereClause: { roster: { leagueId: { in: string[] } }; player?: { sleeperId: string } } = {
    roster: { leagueId: { in: leagueIds } },
  };
  if (playerSleeperId) {
    whereClause.player = { sleeperId: playerSleeperId };
  }

  const keepers = await prisma.keeper.findMany({
    where: whereClause,
    include: {
      player: { select: { fullName: true, sleeperId: true } },
      roster: { select: { sleeperId: true, teamName: true } },
    },
    orderBy: [{ playerId: "asc" }, { season: "asc" }],
  }) as KeeperWithDetails[];

  console.log(`\nProcessing ${keepers.length} keeper records...`);

  // Group keepers by player
  const keepersByPlayer = new Map<string, KeeperWithDetails[]>();
  for (const keeper of keepers) {
    if (!keepersByPlayer.has(keeper.playerId)) {
      keepersByPlayer.set(keeper.playerId, []);
    }
    keepersByPlayer.get(keeper.playerId)!.push(keeper);
  }

  let totalUpdated = 0;

  for (const [playerId, playerKeepers] of keepersByPlayer) {
    const playerName = playerKeepers[0]?.player?.fullName || "Unknown";
    const playerSleeperIdFromKeeper = playerKeepers[0]?.player?.sleeperId || "?";

    console.log(`\n--- ${playerName} (Sleeper ID: ${playerSleeperIdFromKeeper}) ---`);

    // Get original draft info
    const originalDraft = await getOriginalDraft(playerId, leagueIds);
    if (!originalDraft) {
      console.log("  No original draft found, skipping");
      continue;
    }
    const originalDraftTeam = sleeperIdToTeamName.get(originalDraft.rosterSleeperId) || originalDraft.rosterSleeperId;
    console.log(`  Original draft: ${originalDraft.season} by ${originalDraftTeam} (R${originalDraft.round})`);

    // Get all trades for this player
    const trades = await getPlayerTransactions(playerId, leagueIds, rosterMap);
    console.log(`  Found ${trades.length} trades`);
    for (const trade of trades) {
      const fromTeam = trade.fromRosterSleeperId ? sleeperIdToTeamName.get(trade.fromRosterSleeperId) || trade.fromRosterSleeperId : "N/A";
      const toTeam = trade.toRosterSleeperId ? sleeperIdToTeamName.get(trade.toRosterSleeperId) || trade.toRosterSleeperId : "N/A";
      console.log(`    ${trade.date.toISOString().split("T")[0]}: ${fromTeam} -> ${toTeam}`);

      // Show all players in this trade grouped by direction
      const playersTo: string[] = [];
      const playersFrom: string[] = [];
      for (const p of trade.allPlayersInTrade) {
        if (p.toSleeperId === trade.toRosterSleeperId) {
          playersTo.push(p.playerName);
        }
        if (p.fromSleeperId === trade.toRosterSleeperId) {
          playersFrom.push(p.playerName);
        }
      }
      if (playersTo.length > 0 || playersFrom.length > 0) {
        console.log(`      ${toTeam} received: ${playersTo.join(", ") || "N/A"}`);
        console.log(`      ${toTeam} gave up: ${playersFrom.join(", ") || "N/A"}`);
      }
    }

    // Sort keepers by season
    playerKeepers.sort((a, b) => a.season - b.season);

    // Track ownership and years
    let currentOwnerSleeperId = originalDraft.rosterSleeperId;
    let yearsWithCurrentOwner = 0;

    // Process keepers in chronological order
    for (const keeper of playerKeepers) {
      const keeperOwnerSleeperId = keeper.roster.sleeperId;

      // Find the most recent trade where this owner RECEIVED the player
      // that could affect this keeper season (before Sept of that year)
      const tradesBeforeThisSeason = trades.filter(
        (t) => t.date <= new Date(keeper.season, 8, 1) // Before Sept of keeper year
      );

      const tradeToThisOwner = tradesBeforeThisSeason
        .filter((t) => t.toRosterSleeperId === keeperOwnerSleeperId)
        .pop(); // Get most recent

      // Also find any trades AWAY from this owner before this season
      const tradeAwayFromThisOwner = tradesBeforeThisSeason
        .filter((t) => t.fromRosterSleeperId === keeperOwnerSleeperId)
        .pop(); // Get most recent trade away

      let shouldReset = false;
      let resetReason = "";

      // Check if owner changed from previous keeper record
      const previousKeeperByAnyOwner = playerKeepers.find(
        (k) => k.season === keeper.season - 1
      );


      // KEY LOGIC: Check if this owner traded the player away and then got them back
      // via an offseason trade - this should reset years
      if (tradeToThisOwner && tradeAwayFromThisOwner) {
        // Owner traded away, then got back
        if (tradeToThisOwner.date > tradeAwayFromThisOwner.date) {
          // They got the player back AFTER trading away
          const isOffseason = isOffseasonTradeForKeeper(tradeToThisOwner.date, keeper.season);
          if (isOffseason) {
            shouldReset = true;
            resetReason = `Got back via offseason trade on ${tradeToThisOwner.date.toISOString().split("T")[0]} (after trading away on ${tradeAwayFromThisOwner.date.toISOString().split("T")[0]})`;
          }
        }
      }

      const ownerChangedFromPreviousKeeper =
        previousKeeperByAnyOwner &&
        previousKeeperByAnyOwner.roster.sleeperId !== keeperOwnerSleeperId;

      if (!shouldReset && ownerChangedFromPreviousKeeper) {
        // Owner changed between keeper seasons - check if it was an offseason trade
        if (tradeToThisOwner) {
          const isOffseason = isOffseasonTradeForKeeper(tradeToThisOwner.date, keeper.season);
          if (isOffseason) {
            shouldReset = true;
            resetReason = `Offseason trade on ${tradeToThisOwner.date.toISOString().split("T")[0]}`;
          } else {
            // In-season trade in previous year - still resets for new owner
            shouldReset = true;
            resetReason = `Trade on ${tradeToThisOwner.date.toISOString().split("T")[0]} (new owner)`;
          }
        } else {
          // Owner changed but no trade found - still reset
          shouldReset = true;
          resetReason = "Owner changed (no trade record found)";
        }
        currentOwnerSleeperId = keeperOwnerSleeperId;
      } else if (!shouldReset && !previousKeeperByAnyOwner && keeper !== playerKeepers[0]) {
        // No previous keeper but not the first keeper - gap in keeper history
        // Check if this owner acquired via trade
        if (tradeToThisOwner && tradeToThisOwner.fromRosterSleeperId !== keeperOwnerSleeperId) {
          shouldReset = true;
          resetReason = `First keeper after trade on ${tradeToThisOwner.date.toISOString().split("T")[0]}`;
        }
      } else if (!shouldReset && keeper === playerKeepers[0]) {
        // First keeper record - check if acquired via trade from original drafter
        if (keeperOwnerSleeperId !== originalDraft.rosterSleeperId && tradeToThisOwner) {
          const isOffseason = isOffseasonTradeForKeeper(tradeToThisOwner.date, keeper.season);
          if (isOffseason) {
            shouldReset = true;
            resetReason = `Offseason trade from original drafter on ${tradeToThisOwner.date.toISOString().split("T")[0]}`;
          }
        }
      }

      // Calculate correct years
      let correctYearsKept: number;
      if (shouldReset) {
        correctYearsKept = 1;
        yearsWithCurrentOwner = 1;
        console.log(`  ${keeper.season}: RESET to Year 1 (${resetReason})`);
      } else {
        // Continue from previous
        yearsWithCurrentOwner++;
        correctYearsKept = yearsWithCurrentOwner;
      }

      // Calculate correct final cost
      const costReduction = correctYearsKept - 1;
      const correctFinalCost = Math.max(1, keeper.baseCost - costReduction);

      // Check if update needed
      if (keeper.yearsKept !== correctYearsKept || keeper.finalCost !== correctFinalCost) {
        console.log(
          `  ${keeper.season}: ${keeper.roster.teamName} - Year ${keeper.yearsKept} -> Year ${correctYearsKept}, ` +
          `Cost R${keeper.finalCost} -> R${correctFinalCost}`
        );

        await prisma.keeper.update({
          where: { id: keeper.id },
          data: {
            yearsKept: correctYearsKept,
            finalCost: correctFinalCost,
          },
        });
        totalUpdated++;
      } else {
        console.log(`  ${keeper.season}: ${keeper.roster.teamName} - Year ${keeper.yearsKept} (correct)`);
      }
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`COMPLETE: Updated ${totalUpdated} keeper records`);
  console.log("=".repeat(60));

  return { totalUpdated };
}

async function main() {
  // Get the league ID from command line or use default
  const args = process.argv.slice(2);
  const leagueSleeperIdArg = args.find((a) => a.startsWith("--league="))?.split("=")[1];
  const playerSleeperIdArg = args.find((a) => a.startsWith("--player="))?.split("=")[1];

  // Find the league
  let league;
  if (leagueSleeperIdArg) {
    league = await prisma.league.findFirst({
      where: { sleeperId: leagueSleeperIdArg },
    });
  } else {
    // Get first league (for testing)
    league = await prisma.league.findFirst({
      orderBy: { season: "desc" },
    });
  }

  if (!league) {
    console.error("No league found");
    process.exit(1);
  }

  console.log(`Processing league: ${league.name} (${league.season})`);

  await fixKeeperYears(league.id, playerSleeperIdArg);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
