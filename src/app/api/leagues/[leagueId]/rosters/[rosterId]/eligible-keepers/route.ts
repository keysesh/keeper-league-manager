import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getKeeperPlanningSeason, isTradeAfterDeadline } from "@/lib/constants/keeper-rules";
import { DEFAULT_KEEPER_RULES } from "@/lib/constants/keeper-rules";
import { AcquisitionType, KeeperType } from "@prisma/client";
import { logger } from "@/lib/logger";

/**
 * Get the NFL season for a given date
 * NFL season runs Sept-Feb: 2024 season = Sept 2024 - Feb 2025
 */
function getSeasonFromDate(date: Date): number {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();

  // January/February = still previous season
  if (month < 2) {
    return year - 1;
  }
  // March-August = preparing for current year's season
  // September+ = current year's season
  return year;
}

interface RouteParams {
  params: Promise<{ leagueId: string; rosterId: string }>;
}

/**
 * GET /api/leagues/[leagueId]/rosters/[rosterId]/eligible-keepers
 *
 * OPTIMIZED: Fetches all data in batch queries instead of per-player queries
 * Reduced from 100+ queries to ~5 queries
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId, rosterId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this league (is a team member)
    const userAccess = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        rosters: {
          select: {
            teamMembers: {
              where: { userId: session.user.id },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!userAccess || !userAccess.rosters.some((r) => r.teamMembers.length > 0)) {
      return NextResponse.json({ error: "You don't have access to this league" }, { status: 403 });
    }

    const season = getKeeperPlanningSeason();

    // BATCH QUERY 1: Get roster with players, keepers, and league settings in ONE query
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        league: {
          include: { keeperSettings: true },
        },
        rosterPlayers: {
          include: {
            player: {
              include: {
                seasonStats: {
                  // Fetch last 4 seasons to ensure we have data even if recent seasons not synced
                  where: {
                    season: { gte: season - 4 },
                  },
                  orderBy: { season: "desc" },
                },
              },
            },
          },
        },
        keepers: {
          where: { season: { lte: season } },
          orderBy: { season: "desc" },
        },
      },
    });

    if (!roster || roster.leagueId !== leagueId) {
      return NextResponse.json({ error: "Roster not found" }, { status: 404 });
    }

    const league = roster.league;
    if (!league?.keeperSettings) {
      return NextResponse.json({ error: "League keeper settings not found" }, { status: 400 });
    }

    const settings = league.keeperSettings;
    const maxYears = settings.regularKeeperMaxYears ?? DEFAULT_KEEPER_RULES.REGULAR_KEEPER_MAX_YEARS;
    const undraftedRound = settings.undraftedRound ?? DEFAULT_KEEPER_RULES.UNDRAFTED_ROUND;
    const minRound = settings.minimumRound ?? DEFAULT_KEEPER_RULES.MINIMUM_ROUND;
    // Note: costReduction is no longer used for initial cost - cost only reduces with years kept

    // Get all player IDs on this roster
    const playerIds = roster.rosterPlayers.map(rp => rp.playerId);

    // Build league chain to get ALL historical leagues (previousLeagueId is stored as sleeperId)
    const allLeagueIds: string[] = [leagueId];
    let currentPrevId = league.previousLeagueId;
    let chainDepth = 0;
    while (currentPrevId && chainDepth < 10) {
      // previousLeagueId is stored as Sleeper ID, need to find by sleeperId
      const prevLeague = await prisma.league.findFirst({
        where: { sleeperId: currentPrevId },
        select: { id: true, previousLeagueId: true },
      });
      if (!prevLeague) break;
      allLeagueIds.push(prevLeague.id);
      currentPrevId = prevLeague.previousLeagueId;
      chainDepth++;
    }

    // BATCH QUERY 2: Get all draft picks for all players across ALL leagues in the chain
    // This ensures we count keeper years from previous seasons correctly
    const draftPicks = await prisma.draftPick.findMany({
      where: {
        playerId: { in: playerIds },
        draft: { leagueId: { in: allLeagueIds } }, // Include all historical leagues
      },
      include: {
        draft: true,
        roster: { select: { sleeperId: true } },
      },
      orderBy: { draft: { season: "asc" } }, // Oldest first to get original draft
    });

    // BATCH QUERY 3: Get ALL transactions for all players (to follow trade chains)
    // We need transactions to/from any roster to trace origin back through trades
    const transactions = await prisma.transactionPlayer.findMany({
      where: {
        playerId: { in: playerIds },
      },
      include: { transaction: true },
      orderBy: { transaction: { createdAt: "desc" } },
    });

    // BATCH QUERY 4: Get all rosters across ALL leagues in chain to build rosterId -> sleeperId map
    // This allows us to match transactions across seasons (roster IDs change each year)
    const allRosters = await prisma.roster.findMany({
      where: { leagueId: { in: allLeagueIds } },
      select: { id: true, sleeperId: true },
    });

    // Build rosterId -> sleeperId map for transaction matching
    const rosterToSleeperMap = new Map<string, string>();
    for (const r of allRosters) {
      if (r.sleeperId) {
        rosterToSleeperMap.set(r.id, r.sleeperId);
      }
    }

    // Build lookup maps for O(1) access
    // Store the ORIGINAL (oldest) draft pick for each player
    const originalDraftMap = new Map<string, typeof draftPicks[0]>();
    // Store the MOST RECENT draft pick (for current roster check)
    const recentDraftMap = new Map<string, typeof draftPicks[0]>();
    for (const pick of draftPicks) {
      if (pick.playerId) {
        // First occurrence is the original (oldest due to asc order)
        if (!originalDraftMap.has(pick.playerId)) {
          originalDraftMap.set(pick.playerId, pick);
        }
        // Always update recent to get the latest
        recentDraftMap.set(pick.playerId, pick);
      }
    }

    const transactionMap = new Map<string, typeof transactions[0]>();
    for (const tx of transactions) {
      if (tx.playerId && !transactionMap.has(tx.playerId)) {
        transactionMap.set(tx.playerId, tx);
      }
    }

    // Get current roster's sleeperId for matching across seasons
    const currentSleeperId = roster.sleeperId;

    // Build keeper history map (player -> keepers)
    // Combine data from:
    // 1. Keeper table (explicit keeper designations in our app)
    // 2. DraftPick.isKeeper = true (Sleeper's historical keeper data)
    const keepersByPlayer = new Map<string, typeof roster.keepers>();
    for (const keeper of roster.keepers) {
      const existing = keepersByPlayer.get(keeper.playerId) || [];
      existing.push(keeper);
      keepersByPlayer.set(keeper.playerId, existing);
    }

    // Also track keeper picks from Sleeper (isKeeper flag on draft picks)
    // These represent historical keeper designations that may not be in our Keeper table
    // FIX: Track ALL keeper picks for a player regardless of who owned them at the time
    // This ensures offseason trade acquisitions correctly count years kept by previous owners
    const keeperPicksByPlayer = new Map<string, number[]>(); // playerId -> array of seasons kept
    for (const pick of draftPicks) {
      // Include ALL keeper picks for this player across ALL rosters (not just current owner)
      // This ensures George Pickens shows yearsKept=3 even if traded after being kept
      if (pick.isKeeper && pick.playerId) {
        const seasons = keeperPicksByPlayer.get(pick.playerId) || [];
        if (!seasons.includes(pick.draft.season)) {
          seasons.push(pick.draft.season);
        }
        keeperPicksByPlayer.set(pick.playerId, seasons);
      }
    }

    // Current season keepers
    const currentSeasonKeepers = roster.keepers.filter(k => k.season === season);
    const franchiseCount = currentSeasonKeepers.filter(k => k.type === KeeperType.FRANCHISE).length;
    const regularCount = currentSeasonKeepers.filter(k => k.type === KeeperType.REGULAR).length;
    const canAddFranchise = franchiseCount < settings.maxFranchiseTags;

    // Helper: Get original draft info for a player
    function getOriginalDraft(playerId: string): { draftYear: number; draftRound: number } | null {
      const originalPick = originalDraftMap.get(playerId);
      if (originalPick) {
        return {
          draftYear: originalPick.draft.season,
          draftRound: originalPick.round,
        };
      }
      return null;
    }

    /**
     * Get Origin Season for a player on the current roster
     *
     * Origin Season is the "keeper start season" for eligibility calculation.
     * - Drafted by this owner (matching sleeperId) → origin = draft season
     * - In-season trade → origin = inherited from previous owner
     * - Offseason trade → origin = RESETS to trade season (next season)
     * - Waiver/FA → origin = pickup season
     *
     * IMPORTANT: isKeeper=true draft picks are keeper SLOTS, not original drafts.
     * We filter those out and look for the actual original draft.
     */
    function getOriginSeason(
      playerId: string,
      targetSleeperId: string,
      visited: Set<string> = new Set()
    ): { originSeason: number; acquisitionType: AcquisitionType; draftRound?: number } {
      // Prevent infinite loops in trade chains
      const key = `${playerId}-${targetSleeperId}`;
      if (visited.has(key)) {
        return { originSeason: season, acquisitionType: AcquisitionType.WAIVER };
      }
      visited.add(key);

      // IMPORTANT: Check for trade acquisition FIRST before looking at keeper records
      // This ensures offseason trades properly reset keeper years
      const tradeAcquisition = transactions.find(
        (tx) => tx.playerId === playerId &&
                tx.toRosterId &&
                rosterToSleeperMap.get(tx.toRosterId) === targetSleeperId &&
                tx.transaction.type === "TRADE"
      );

      if (tradeAcquisition) {
        const txDate = tradeAcquisition.transaction.createdAt;
        const txSeason = getSeasonFromDate(txDate);

        // Check if this is an offseason trade (should reset keeper years)
        // Two conditions make a trade "offseason":
        // 1. Trade happened after the previous season's deadline (Dec-Aug)
        // 2. Trade happened before the current planning season started (before Sept)
        const tradeMonth = txDate.getMonth();
        const tradeYear = txDate.getFullYear();

        // A trade is offseason if it happened AFTER the player was last kept by someone else
        // For the current planning season, offseason trades include:
        // 1. Trades in the current year before September (Jan-Aug of planning year)
        // 2. Trades in the previous year after the trade deadline (Dec of previous year)
        // 3. Trades in the previous year's offseason (Jan-Aug of previous year, before that draft)
        //
        // The key insight: if the player was traded to current owner BEFORE their first keeper season,
        // that trade resets their keeper years to Year 1.
        const isCurrentYearPreSeason = tradeYear === season && tradeMonth < 8;
        const isPreviousYearOffseason = tradeYear === season - 1 && (tradeMonth >= 11 || tradeMonth < 8);
        const isAfterDeadline = isTradeAfterDeadline(txDate, txSeason);
        const isOffseasonTrade = isCurrentYearPreSeason || isPreviousYearOffseason || isAfterDeadline;

        logger.debug("Trade detection", {
          playerId,
          txDate: txDate.toISOString(),
          tradeYear,
          tradeMonth,
          planningSeason: season,
          isCurrentYearPreSeason,
          isPreviousYearOffseason,
          isAfterDeadline,
          isOffseasonTrade
        });

        if (isOffseasonTrade) {
          // Offseason trade: years reset for new owner
          // Get original draft round from any source for cost calculation
          const originalDraft = draftPicks.find(
            (p) => p.playerId === playerId && !p.isKeeper
          );
          const playerKeepers = keepersByPlayer.get(playerId) || [];
          const earliestKeeper = playerKeepers.length > 0
            ? playerKeepers.reduce((e, k) => k.season < e.season ? k : e)
            : null;

          return {
            originSeason: season, // Reset to current season = Year 1
            acquisitionType: AcquisitionType.TRADE,
            draftRound: originalDraft?.round ?? earliestKeeper?.baseCost,
          };
        }
      }

      // 0. Check existing keeper records - they have authoritative yearsKept data
      // This handles cases where historical draft data isn't synced
      const playerKeepers = keepersByPlayer.get(playerId) || [];
      if (playerKeepers.length > 0) {
        // Find the earliest keeper record to calculate origin
        const earliestKeeper = playerKeepers.reduce((earliest, k) =>
          k.season < earliest.season ? k : earliest
        );
        // Origin = earliest keeper season - (yearsKept - 1)
        // e.g., if 2025 keeper has yearsKept=3, origin was 2023
        const originFromKeeper = earliestKeeper.season - (earliestKeeper.yearsKept - 1);

        // Try to find the original draft round from non-keeper draft picks
        const originalDraft = draftPicks.find(
          (p) => p.playerId === playerId &&
                 p.roster?.sleeperId === targetSleeperId &&
                 !p.isKeeper
        );

        return {
          originSeason: originFromKeeper,
          acquisitionType: AcquisitionType.DRAFTED, // Assume drafted if has keeper history
          draftRound: originalDraft?.round ?? earliestKeeper.baseCost,
        };
      }

      // 1. Check if player was drafted by this owner (matching sleeperId across seasons)
      // IMPORTANT: Filter out isKeeper=true picks - those are keeper SLOTS, not original drafts
      const draftPick = draftPicks.find(
        (p) => p.playerId === playerId &&
               p.roster?.sleeperId === targetSleeperId &&
               !p.isKeeper
      );

      if (draftPick) {
        // Player was drafted by this owner - origin is draft season
        return {
          originSeason: draftPick.draft.season,
          acquisitionType: AcquisitionType.DRAFTED,
          draftRound: draftPick.round,
        };
      }

      // 2. Find the most recent acquisition transaction for this owner (by sleeperId)
      // Transactions use rosterId, so we convert to sleeperId for matching across seasons
      const acquisition = transactions.find(
        (tx) => tx.playerId === playerId &&
                tx.toRosterId &&
                rosterToSleeperMap.get(tx.toRosterId) === targetSleeperId
      );

      if (!acquisition) {
        // No transaction found - treat as current season (waiver pickup)
        return { originSeason: season, acquisitionType: AcquisitionType.WAIVER };
      }

      const txDate = acquisition.transaction.createdAt;
      const txType = acquisition.transaction.type;
      const txSeason = getSeasonFromDate(txDate);

      // 3. Handle non-trade acquisitions (waiver, FA)
      if (txType !== "TRADE") {
        const acqType = txType === "WAIVER" ? AcquisitionType.WAIVER : AcquisitionType.FREE_AGENT;

        // Check if player was dropped in the same season
        // If dropped and picked up same season, preserve eligibility from previous owner
        if (acquisition.fromRosterId) {
          const fromSleeperId = rosterToSleeperMap.get(acquisition.fromRosterId);
          if (fromSleeperId) {
            // Player was dropped - check the drop season
            const dropTx = transactions.find(
              (tx) => tx.playerId === playerId && tx.fromRosterId === acquisition.fromRosterId
            );

            if (dropTx) {
              const dropSeason = getSeasonFromDate(dropTx.transaction.createdAt);

              // Same season pickup - follow chain to get origin from previous owner
              if (dropSeason === txSeason) {
                const previousOrigin = getOriginSeason(playerId, fromSleeperId, visited);
                return {
                  originSeason: previousOrigin.originSeason,
                  acquisitionType: acqType,
                  draftRound: previousOrigin.draftRound,
                };
              }
            }
          }
        }

        // Different season or no previous owner - origin resets to pickup season
        return { originSeason: txSeason, acquisitionType: acqType };
      }

      // 4. Handle trades - check trade deadline
      // Mid-season trade (before deadline): inherit everything from previous owner
      // Offseason trade (after deadline): reset years to 0, but preserve draft round
      if (acquisition.fromRosterId) {
        const fromSleeperId = rosterToSleeperMap.get(acquisition.fromRosterId);
        if (fromSleeperId) {
          // Get the previous owner's origin to find the draft round
          const previousOrigin = getOriginSeason(playerId, fromSleeperId, visited);

          // Check if this trade was after the deadline
          const tradeSeason = getSeasonFromDate(txDate);
          const isOffseasonTrade = isTradeAfterDeadline(txDate, tradeSeason);

          if (isOffseasonTrade) {
            // Offseason trade: years reset (originSeason = current planning season)
            // but draft round is preserved for cost calculation
            return {
              originSeason: season, // Reset to current season = Year 1
              acquisitionType: AcquisitionType.TRADE,
              draftRound: previousOrigin.draftRound, // Preserve draft round for cost
            };
          } else {
            // Mid-season trade: inherit everything from previous owner
            return {
              originSeason: previousOrigin.originSeason,
              acquisitionType: AcquisitionType.TRADE,
              draftRound: previousOrigin.draftRound,
            };
          }
        }
      }

      // Fallback: if we can't trace the chain, look up original draft directly
      const originalDraft = originalDraftMap.get(playerId);
      if (originalDraft) {
        return {
          originSeason: season, // Can't determine trade timing, assume current season
          acquisitionType: AcquisitionType.TRADE,
          draftRound: originalDraft.round,
        };
      }

      // No draft found - treat as undrafted, current season
      return { originSeason: season, acquisitionType: AcquisitionType.TRADE };
    }

    // Legacy helper for acquisition type (for cost calculation)
    function getAcquisition(playerId: string): {
      type: AcquisitionType;
      draftRound?: number;
      isPostDeadlineTrade: boolean;
      tradeDate?: Date;
    } {
      const origin = getOriginSeason(playerId, currentSleeperId);
      const transaction = transactionMap.get(playerId);

      // Check if this is a post-deadline trade
      // A trade is "post-deadline" only if:
      // 1. It's actually a trade acquisition
      // 2. The trade itself happened after the deadline (checked via isTradeAfterDeadline in getOriginSeason)
      //
      // When getOriginSeason detects an offseason trade, it sets originSeason = txSeason + 1
      // This means: if originSeason > season (current), or if originSeason === season but
      // the origin was reset (not inherited from drafter), it's a post-deadline trade.
      //
      // The key indicator: if acquisition is TRADE and there's no draftRound inherited,
      // that means the trade chain ended at an offseason trade reset point.
      const isPostDeadlineTrade =
        origin.acquisitionType === AcquisitionType.TRADE &&
        !origin.draftRound; // No inherited draft round = value was reset at trade

      return {
        type: origin.acquisitionType,
        draftRound: origin.draftRound,
        isPostDeadlineTrade,
        tradeDate: transaction?.transaction.createdAt,
      };
    }

    // Helper: Calculate base cost (pure function, no DB calls)
    // Post-deadline trades reset to undrafted round
    // Before-deadline trades preserve original draft value
    // NO initial cost reduction - cost only improves with years kept
    function calculateBaseCost(playerId: string): { baseCost: number; isPostDeadlineTrade: boolean } {
      const acquisition = getAcquisition(playerId);

      // Post-deadline trades ALWAYS reset to undrafted round
      if (acquisition.isPostDeadlineTrade) {
        return { baseCost: undraftedRound, isPostDeadlineTrade: true };
      }

      let baseCost: number;
      switch (acquisition.type) {
        case AcquisitionType.DRAFTED:
          // Base cost = draft round (no initial reduction)
          baseCost = acquisition.draftRound || undraftedRound;
          break;
        case AcquisitionType.TRADE:
          // Before-deadline trade: preserve original draft value
          // First try to use inherited draft round from trade chain
          // Then fall back to original draft lookup
          if (acquisition.draftRound) {
            baseCost = acquisition.draftRound;
          } else {
            const originalDraft = getOriginalDraft(playerId);
            if (originalDraft) {
              baseCost = originalDraft.draftRound;
            } else {
              baseCost = undraftedRound;
            }
          }
          break;
        case AcquisitionType.WAIVER:
        case AcquisitionType.FREE_AGENT:
        default:
          baseCost = undraftedRound;
      }

      return { baseCost: Math.max(minRound, baseCost), isPostDeadlineTrade: false };
    }

    /**
     * Calculate eligibility using Keeper History approach
     *
     * Core rules:
     * - "Years kept" = how many times a player has been designated as a keeper
     * - Keeper history comes from:
     *   1. Keeper table (our app's keeper designations)
     *   2. DraftPick.isKeeper = true (Sleeper's historical data)
     * - Players with NO keeper history would be Year 1 (first time being kept)
     * - Regular keeper: can be kept for up to `regularKeeperMaxYears` (default 2)
     * - maxYears=1 means Year 1 is eligible, Year 2+ needs FT
     * - maxYears=2 means Year 1-2 are eligible, Year 3+ needs FT
     * - Franchise tag has no year limit (can be used indefinitely)
     */
    function calculateEligibility(playerId: string) {
      const origin = getOriginSeason(playerId, currentSleeperId);
      const originalDraft = getOriginalDraft(playerId);
      const costResult = calculateBaseCost(playerId);

      // Check keeper history from BOTH sources:
      // 1. Keeper table (our app's explicit keeper designations)
      const playerKeepers = keepersByPlayer.get(playerId) || [];
      // 2. DraftPick.isKeeper = true (Sleeper's historical keeper data)
      const keeperPickSeasons = keeperPicksByPlayer.get(playerId) || [];

      // Check if this is a post-deadline (offseason) trade - years reset for new owner
      const isPostDeadlineTrade = origin.originSeason === season && origin.acquisitionType === AcquisitionType.TRADE;

      // FIX: For offseason trades, reset keeper years to 0 (don't count previous owner's history)
      // This is the core rule: "Offseason trades reset keeper years"
      let pastKeeperCount: number;
      let isAlreadyKeptThisSeason: boolean;

      if (isPostDeadlineTrade) {
        // Offseason trade: new owner starts fresh at Year 1
        // Don't count any keeper history from previous owners
        pastKeeperCount = 0;
        isAlreadyKeptThisSeason = false;
      } else {
        // Same owner or pre-deadline trade: count all keeper years
        // Collect unique seasons from both sources
        const allKeeperSeasons = new Set<number>();

        // Add seasons from Keeper table
        for (const keeper of playerKeepers) {
          allKeeperSeasons.add(keeper.season);
        }

        // Add seasons from isKeeper draft picks
        for (const pickSeason of keeperPickSeasons) {
          allKeeperSeasons.add(pickSeason);
        }

        // Count past keeper seasons (before the planning season)
        const pastKeeperSeasons = Array.from(allKeeperSeasons).filter(s => s < season);
        pastKeeperCount = pastKeeperSeasons.length;
        isAlreadyKeptThisSeason = allKeeperSeasons.has(season);
      }

      // Determine display year (how many times kept including this potential keep)
      let displayYear: number;
      if (isAlreadyKeptThisSeason) {
        // Already designated as keeper for current planning season
        displayYear = pastKeeperCount + 1;
      } else {
        // Would be their next keeper year if kept
        displayYear = pastKeeperCount + 1;
      }

      // A player can always be kept via Franchise Tag (no year limit)
      // But regular keeper is limited to maxYears
      // displayYear: 1 = year 1, 2 = year 2, etc.
      // canBeRegularKeeper: Year 1 through maxYears are eligible
      const canBeRegularKeeper = displayYear <= maxYears;
      const mustBeFranchise = displayYear > maxYears;
      const isEligible = true; // Players are always eligible (via FT if needed)
      const atMaxYears = mustBeFranchise;

      // Build reason string
      let reason: string | undefined;
      if (mustBeFranchise) {
        reason = `Year ${displayYear} - Franchise Tag required`;
      } else if (displayYear === maxYears) {
        reason = `Final regular keeper year (Year ${displayYear} of ${maxYears})`;
      } else if (displayYear === 1) {
        reason = "First time keeping";
      }

      // Cost calculation: base cost improves by 1 for each year kept (0-indexed)
      // displayYear 1 = 0 years of improvement, displayYear 2 = 1 year improvement, etc.
      const baseCost = costResult.baseCost;
      const yearsOfImprovement = displayYear - 1;
      const escalatedCost = Math.max(minRound, baseCost - yearsOfImprovement);

      return {
        isEligible,
        canBeRegularKeeper,
        mustBeFranchise,
        yearsKept: displayYear, // Display value (1-indexed)
        consecutiveYears: displayYear - 1, // Keep for backwards compatibility (0-indexed)
        originSeason: origin.originSeason,
        acquisitionType: origin.acquisitionType,
        atMaxYears, // Backwards compatibility
        reason,
        baseCost,
        escalatedCost,
        originalDraft,
        isPostDeadlineTrade: origin.originSeason === season && origin.acquisitionType === AcquisitionType.TRADE,
      };
    }

    // Process all players (no DB calls - all in memory)
    const eligiblePlayers = roster.rosterPlayers.map((rp) => {
      const eligibility = calculateEligibility(rp.playerId);
      const existingKeeper = currentSeasonKeepers.find(k => k.playerId === rp.playerId);

      let franchiseCost = null;
      let regularCost = null;
      let effectivelyEligible = eligibility.isEligible;
      let reason = eligibility.reason;

      // Franchise tag uses same cost formula as regular keeper
      // The only difference is FT is required after Year 2, and has no year limit
      const ftBaseCost = eligibility.baseCost;
      const ftFinalCost = eligibility.escalatedCost;
      const ftYearsKept = eligibility.consecutiveYears;

      let ftCostBreakdown = `R${ftBaseCost}`;
      if (ftYearsKept > 0) {
        ftCostBreakdown = `R${ftBaseCost} - ${ftYearsKept}yr = R${ftFinalCost}`;
      }

      franchiseCost = {
        baseCost: ftBaseCost,
        finalCost: ftFinalCost,
        costBreakdown: `Franchise Tag: ${ftCostBreakdown}`,
      };

      // Rule: After 2 consecutive years being kept, must use FT (Year 3+)
      // Years 1-2 can be Regular OR FT, Year 3+ is FT only
      if (eligibility.canBeRegularKeeper) {
        // Regular keeper available for Years 1 through maxYears
        const baseCost = eligibility.baseCost;
        const finalCost = eligibility.escalatedCost;
        const yearsKept = eligibility.consecutiveYears;

        let costBreakdown = `R${baseCost}`;
        if (eligibility.isPostDeadlineTrade) {
          costBreakdown = `R${baseCost} (offseason trade - reset)`;
        } else if (yearsKept > 0) {
          costBreakdown = `R${baseCost} - ${yearsKept}yr = R${finalCost}`;
        }

        regularCost = {
          baseCost,
          finalCost,
          costBreakdown,
        };
      } else if (eligibility.mustBeFranchise) {
        // Year 3+ - must use franchise tag, no regular keeper option
        if (!canAddFranchise) {
          effectivelyEligible = false;
          reason = `Year ${eligibility.yearsKept} - Franchise Tag required but none available`;
        }
      }

      // Calculate PPG from season stats - use most recent seasons with actual data
      const seasonStats = rp.player.seasonStats || [];
      // Filter to seasons with games played and sort descending
      const seasonsWithData = seasonStats
        .filter(s => s.gamesPlayed > 0)
        .sort((a, b) => b.season - a.season);

      const lastSeasonStats = seasonsWithData[0] || null;
      const prevSeasonStats = seasonsWithData[1] || null;

      // Calculate PPG from actual stats, or fall back to projections for rookies
      let lastSeasonPpg: number | null = null;
      let isProjected = false;

      if (lastSeasonStats) {
        // Has actual stats from a recent season
        lastSeasonPpg = Math.round((lastSeasonStats.fantasyPointsPpr / lastSeasonStats.gamesPlayed) * 10) / 10;
      } else if (rp.player.projectedPoints && rp.player.projectedPoints > 0) {
        // No historical stats - use projected points (divide by 17 games for PPG estimate)
        lastSeasonPpg = Math.round((rp.player.projectedPoints / 17) * 10) / 10;
        isProjected = true;
      } else if (rp.player.pointsPerGame && rp.player.pointsPerGame > 0) {
        // Fall back to player's overall PPG if available
        lastSeasonPpg = Math.round(rp.player.pointsPerGame * 10) / 10;
        isProjected = true;
      }

      const prevSeasonPpg = prevSeasonStats
        ? Math.round((prevSeasonStats.fantasyPointsPpr / prevSeasonStats.gamesPlayed) * 10) / 10
        : null;

      return {
        player: {
          id: rp.player.id,
          sleeperId: rp.player.sleeperId,
          fullName: rp.player.fullName,
          firstName: rp.player.firstName,
          lastName: rp.player.lastName,
          position: rp.player.position,
          team: rp.player.team,
          age: rp.player.age,
          yearsExp: rp.player.yearsExp,
          injuryStatus: rp.player.injuryStatus,
          // Fantasy stats (overall from Player model)
          fantasyPointsPpr: rp.player.fantasyPointsPpr,
          fantasyPointsHalfPpr: rp.player.fantasyPointsHalfPpr,
          gamesPlayed: rp.player.gamesPlayed,
          pointsPerGame: rp.player.pointsPerGame,
          // Season-specific PPG (uses most recent available data, or projections for rookies)
          lastSeasonPpg,
          lastSeasonGames: lastSeasonStats?.gamesPlayed ?? null,
          prevSeasonPpg,
          prevSeasonGames: prevSeasonStats?.gamesPlayed ?? null,
          lastSeason: lastSeasonStats?.season ?? (isProjected ? season : season - 1),
          prevSeason: prevSeasonStats?.season ?? season - 2,
          isProjected, // true if lastSeasonPpg is from projections (rookie/no historical data)
        },
        isStarter: rp.isStarter,
        eligibility: {
          isEligible: effectivelyEligible,
          canBeRegularKeeper: eligibility.canBeRegularKeeper,
          mustBeFranchise: eligibility.mustBeFranchise,
          reason,
          yearsKept: eligibility.yearsKept,
          consecutiveYears: eligibility.consecutiveYears,
          originSeason: eligibility.originSeason,
          acquisitionType: eligibility.acquisitionType,
          originalDraft: eligibility.originalDraft,
          // Debug: internal calculation values
          _debug: {
            planningSeason: season,
            originSeason: eligibility.originSeason,
            yearsOnRoster: eligibility.consecutiveYears,
            maxYearsForRegular: maxYears,
            calculatedCanBeRegular: eligibility.consecutiveYears < maxYears,
            isPostDeadlineTrade: eligibility.isPostDeadlineTrade,
          },
        },
        costs: {
          franchise: franchiseCost,
          regular: regularCost,
        },
        existingKeeper: existingKeeper
          ? {
              id: existingKeeper.id,
              type: existingKeeper.type,
              finalCost: existingKeeper.finalCost,
              isLocked: existingKeeper.isLocked,
            }
          : null,
      };
    });

    // Sort: eligible first, then by position, then by name
    const positionOrder: Record<string, number> = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
    eligiblePlayers.sort((a, b) => {
      if (a.eligibility.isEligible !== b.eligibility.isEligible) {
        return a.eligibility.isEligible ? -1 : 1;
      }
      const posA = positionOrder[a.player.position || ""] || 99;
      const posB = positionOrder[b.player.position || ""] || 99;
      if (posA !== posB) return posA - posB;
      return (a.player.fullName || "").localeCompare(b.player.fullName || "");
    });

    const response = NextResponse.json({
      rosterId,
      season,
      players: eligiblePlayers,
      currentKeepers: {
        franchise: franchiseCount,
        regular: regularCount,
        total: currentSeasonKeepers.length,
      },
      limits: {
        maxKeepers: settings.maxKeepers,
        maxFranchiseTags: settings.maxFranchiseTags,
        maxRegularKeepers: settings.maxRegularKeepers,
      },
      canAddMore: {
        franchise: canAddFranchise,
        regular: regularCount < settings.maxRegularKeepers,
        any: currentSeasonKeepers.length < settings.maxKeepers,
      },
      // Debug: keeper year rules
      keeperRules: {
        regularKeeperMaxYears: maxYears,
        undraftedRound,
        minimumRound: minRound,
      },
    });

    // No caching - keeper data must always be fresh after add/remove operations
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  } catch (error) {
    logger.error("Error fetching eligible keepers", error);
    return NextResponse.json({ error: "Failed to fetch eligible keepers" }, { status: 500 });
  }
}
