import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason, isTradeAfterDeadline } from "@/lib/constants/keeper-rules";
import { DEFAULT_KEEPER_RULES } from "@/lib/constants/keeper-rules";
import { AcquisitionType, KeeperType } from "@prisma/client";

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

    const season = getCurrentSeason();

    // BATCH QUERY 1: Get roster with players, keepers, and league settings in ONE query
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        league: {
          include: { keeperSettings: true },
        },
        rosterPlayers: {
          include: { player: true },
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
    const costReduction = settings.costReductionPerYear ?? DEFAULT_KEEPER_RULES.COST_REDUCTION_PER_YEAR;

    // Get all player IDs on this roster
    const playerIds = roster.rosterPlayers.map(rp => rp.playerId);

    // BATCH QUERY 2: Get all draft picks for all players (including historical for original draft info)
    const draftPicks = await prisma.draftPick.findMany({
      where: {
        playerId: { in: playerIds },
      },
      include: { draft: true },
      orderBy: { draft: { season: "asc" } }, // Oldest first to get original draft
    });

    // BATCH QUERY 3: Get all transactions for all players at once
    const transactions = await prisma.transactionPlayer.findMany({
      where: {
        playerId: { in: playerIds },
        toRosterId: rosterId,
      },
      include: { transaction: true },
      orderBy: { transaction: { createdAt: "desc" } },
    });

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

    // Build keeper history map (player -> keepers)
    const keepersByPlayer = new Map<string, typeof roster.keepers>();
    for (const keeper of roster.keepers) {
      const existing = keepersByPlayer.get(keeper.playerId) || [];
      existing.push(keeper);
      keepersByPlayer.set(keeper.playerId, existing);
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

    // Helper: Get acquisition type for a player (pure function, no DB calls)
    // Also tracks if it was a post-deadline trade (keeper value resets)
    function getAcquisition(playerId: string): {
      type: AcquisitionType;
      draftRound?: number;
      isPostDeadlineTrade: boolean;
      tradeDate?: Date;
    } {
      const recentPick = recentDraftMap.get(playerId);
      const transaction = transactionMap.get(playerId);

      if (recentPick) {
        // Check if drafted by current roster or picked up same season
        if (recentPick.rosterId === rosterId) {
          return { type: AcquisitionType.DRAFTED, draftRound: recentPick.round, isPostDeadlineTrade: false };
        }
        // Picked up from another team - check if same season
        if (transaction) {
          const txYear = transaction.transaction.createdAt.getFullYear();
          const draftYear = recentPick.draft.season;
          if (txYear <= draftYear + 1) {
            return { type: AcquisitionType.DRAFTED, draftRound: recentPick.round, isPostDeadlineTrade: false };
          }
        }
      }

      // Check transaction type
      if (transaction) {
        const txType = transaction.transaction.type;
        const txDate = transaction.transaction.createdAt;

        if (txType === "TRADE") {
          // Check if trade was after the deadline
          // Use the season before current to check trade timing
          const tradeSeason = txDate.getMonth() >= 8 ? txDate.getFullYear() : txDate.getFullYear() - 1;
          const isPostDeadline = isTradeAfterDeadline(txDate, tradeSeason);

          return {
            type: AcquisitionType.TRADE,
            isPostDeadlineTrade: isPostDeadline,
            tradeDate: txDate,
          };
        }
        if (txType === "WAIVER") return { type: AcquisitionType.WAIVER, isPostDeadlineTrade: false };
        if (txType === "FREE_AGENT") return { type: AcquisitionType.FREE_AGENT, isPostDeadlineTrade: false };
      }

      return { type: AcquisitionType.WAIVER, isPostDeadlineTrade: false };
    }

    // Helper: Calculate base cost (pure function, no DB calls)
    // Post-deadline trades reset to undrafted round
    // Before-deadline trades preserve original draft value
    function calculateBaseCost(playerId: string): { baseCost: number; isPostDeadlineTrade: boolean } {
      const acquisition = getAcquisition(playerId);

      // Post-deadline trades ALWAYS reset to undrafted round
      if (acquisition.isPostDeadlineTrade) {
        return { baseCost: undraftedRound, isPostDeadlineTrade: true };
      }

      let baseCost: number;
      switch (acquisition.type) {
        case AcquisitionType.DRAFTED:
          const draftRound = acquisition.draftRound || undraftedRound;
          baseCost = Math.max(minRound, draftRound - costReduction);
          break;
        case AcquisitionType.TRADE:
          // Before-deadline trade: preserve original draft value
          const originalDraft = getOriginalDraft(playerId);
          if (originalDraft) {
            baseCost = Math.max(minRound, originalDraft.draftRound - costReduction);
          } else {
            baseCost = undraftedRound;
          }
          break;
        case AcquisitionType.WAIVER:
        case AcquisitionType.FREE_AGENT:
        default:
          baseCost = undraftedRound;
      }

      return { baseCost: Math.max(minRound, baseCost), isPostDeadlineTrade: false };
    }

    // Helper: Calculate eligibility with cost escalation (pure function, no DB calls)
    // Post-deadline trades reset consecutive years to 0
    function calculateEligibility(playerId: string) {
      const playerKeepers = keepersByPlayer.get(playerId) || [];
      const previousKeepers = playerKeepers.filter(k => k.season < season);
      const acquisition = getAcquisition(playerId);
      const costResult = calculateBaseCost(playerId);

      // Count consecutive years kept by this owner
      // BUT: Post-deadline trades reset this to 0 (new acquisition)
      let consecutiveYears = 0;

      if (!costResult.isPostDeadlineTrade) {
        // Only count consecutive years if NOT a post-deadline trade
        let checkSeason = season - 1;
        for (const keeper of previousKeepers.sort((a, b) => b.season - a.season)) {
          if (keeper.season === checkSeason) {
            consecutiveYears++;
            checkSeason--;
          } else {
            break;
          }
        }
      }

      const yearsKept = consecutiveYears + 1; // Including this season if kept
      const atMaxYears = consecutiveYears >= maxYears;
      const originalDraft = getOriginalDraft(playerId);
      const baseCost = costResult.baseCost;

      // COST ESCALATION: Cost improves (earlier round) by 1 for each consecutive year kept
      // Year 1: baseCost (R3), Year 2: baseCost - 1 (R2), Year 3: baseCost - 2 (R1)
      // Minimum is Round 1 (can't go lower)
      // Post-deadline trades start fresh at undrafted round with 0 years
      const escalatedCost = Math.max(minRound, baseCost - consecutiveYears);

      // Eligibility is based on YEARS KEPT, not cost
      // atMaxYears = true when consecutiveYears >= maxYears (default 2)
      let reason = atMaxYears ? "At max years - Franchise Tag only" : undefined;
      if (costResult.isPostDeadlineTrade) {
        reason = reason || "Acquired via offseason trade - value reset";
      }

      return {
        isEligible: true,
        yearsKept,
        consecutiveYears,
        acquisitionType: acquisition.type,
        atMaxYears,
        reason,
        baseCost,
        escalatedCost,
        originalDraft,
        isPostDeadlineTrade: costResult.isPostDeadlineTrade,
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

      if (eligibility.isEligible) {
        // Franchise tag is always Round 1
        franchiseCost = {
          baseCost: 1,
          finalCost: 1,
          costBreakdown: "Franchise Tag = Round 1",
        };

        if (!eligibility.atMaxYears) {
          // Regular keeper cost with escalation (cost improves each year)
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
        } else {
          // At max years - check if FT is available
          if (!canAddFranchise) {
            effectivelyEligible = false;
            reason = "At max years and no Franchise Tags available";
          }
        }
      }

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
        },
        isStarter: rp.isStarter,
        eligibility: {
          isEligible: effectivelyEligible,
          reason,
          yearsKept: eligibility.yearsKept,
          consecutiveYears: eligibility.consecutiveYears,
          acquisitionType: eligibility.acquisitionType,
          originalDraft: eligibility.originalDraft,
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
    });

    // Cache for 30 seconds, stale-while-revalidate for 60 seconds
    response.headers.set('Cache-Control', 'private, s-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error("Error fetching eligible keepers:", error);
    return NextResponse.json({ error: "Failed to fetch eligible keepers" }, { status: 500 });
  }
}
