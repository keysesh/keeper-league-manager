/**
 * Recent Trades API Route
 * GET /api/leagues/[leagueId]/recent-trades - Get recent trades in the league
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface TradedPlayer {
  playerId: string;
  sleeperId: string;
  playerName: string;
  position: string | null;
  team: string | null;
}

interface TradeParty {
  rosterId: string;
  rosterName: string | null;
  playersGiven: TradedPlayer[];
  playersReceived: TradedPlayer[];
  picksGiven: Array<{ season: number; round: number }>;
  picksReceived: Array<{ season: number; round: number }>;
}

interface RecentTrade {
  id: string;
  date: string;
  season: number;
  isNew: boolean; // Less than 24 hours old
  parties: TradeParty[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leagueId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    // Get rosters for name lookup
    const rosters = await prisma.roster.findMany({
      where: { leagueId },
      select: {
        id: true,
        teamName: true,
        sleeperId: true,
      },
    });

    const rosterMap = new Map(rosters.map((r) => [r.id, r]));

    // Get recent trades from Transaction model
    const transactions = await prisma.transaction.findMany({
      where: {
        leagueId,
        type: "TRADE",
      },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                sleeperId: true,
                fullName: true,
                position: true,
                team: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Also get trades from TradeProposal model (accepted ones)
    const acceptedProposals = await prisma.tradeProposal.findMany({
      where: {
        leagueId,
        status: "ACCEPTED",
      },
      include: {
        assets: {
          include: {
            player: {
              select: {
                id: true,
                sleeperId: true,
                fullName: true,
                position: true,
                team: true,
              },
            },
          },
        },
        parties: {
          include: {
            roster: {
              select: {
                id: true,
                teamName: true,
              },
            },
          },
        },
      },
      orderBy: { respondedAt: "desc" },
      take: limit,
    });

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get roster sleeperId to dbId mapping for draft pick lookup
    const sleeperIdToRosterId = new Map(rosters.map((r) => [r.sleeperId, r.id]));

    // Build trades from Transaction model
    const tradesFromTransactions: RecentTrade[] = transactions.map((tx) => {
      // Group players by direction
      const partiesMap = new Map<string, TradeParty>();

      for (const tp of tx.players) {
        const fromRoster = tp.fromRosterId
          ? rosterMap.get(tp.fromRosterId)
          : null;
        const toRoster = tp.toRosterId ? rosterMap.get(tp.toRosterId) : null;

        // Add to "from" party (player given)
        if (tp.fromRosterId) {
          if (!partiesMap.has(tp.fromRosterId)) {
            partiesMap.set(tp.fromRosterId, {
              rosterId: tp.fromRosterId,
              rosterName: fromRoster?.teamName || null,
              playersGiven: [],
              playersReceived: [],
              picksGiven: [],
              picksReceived: [],
            });
          }
          partiesMap.get(tp.fromRosterId)!.playersGiven.push({
            playerId: tp.player.id,
            sleeperId: tp.player.sleeperId,
            playerName: tp.player.fullName,
            position: tp.player.position,
            team: tp.player.team,
          });
        }

        // Add to "to" party (player received)
        if (tp.toRosterId) {
          if (!partiesMap.has(tp.toRosterId)) {
            partiesMap.set(tp.toRosterId, {
              rosterId: tp.toRosterId,
              rosterName: toRoster?.teamName || null,
              playersGiven: [],
              playersReceived: [],
              picksGiven: [],
              picksReceived: [],
            });
          }
          partiesMap.get(tp.toRosterId)!.playersReceived.push({
            playerId: tp.player.id,
            sleeperId: tp.player.sleeperId,
            playerName: tp.player.fullName,
            position: tp.player.position,
            team: tp.player.team,
          });
        }
      }

      // Process draft picks from metadata (Sleeper transactions)
      const metadata = tx.metadata as {
        draft_picks?: Array<{
          season: string;
          round: number;
          roster_id: number;       // Who received this pick (slot number)
          previous_owner_id: number; // Who gave up this pick (slot number)
          owner_id: number;        // Original pick owner (slot number)
        }>;
        roster_ids?: number[];
      } | null;

      if (metadata?.draft_picks && metadata.draft_picks.length > 0) {
        // Get the parties (rosters) involved in this trade
        const parties = Array.from(partiesMap.values());

        for (const pick of metadata.draft_picks) {
          // The pick flows from previous_owner_id to roster_id
          // We need to match these slot numbers to our trade parties

          // Since we already know the parties from player movements,
          // associate the pick with the correct party based on roster_ids order
          const giverSlot = pick.previous_owner_id;
          const receiverSlot = pick.roster_id;

          // Match slots to parties by checking which party had players going which direction
          for (const party of parties) {
            // If this party gave players, they likely received picks (and vice versa)
            // Check metadata.roster_ids to see order
            const rosterSlots = metadata.roster_ids || [];
            const partyIndex = rosterSlots.indexOf(giverSlot);

            if (partyIndex === 0 && parties[0]) {
              // First party in roster_ids gave this pick
              partiesMap.get(parties[0].rosterId)?.picksGiven.push({
                season: parseInt(pick.season),
                round: pick.round,
              });
              if (parties[1]) {
                partiesMap.get(parties[1].rosterId)?.picksReceived.push({
                  season: parseInt(pick.season),
                  round: pick.round,
                });
              }
            } else if (partyIndex === 1 && parties[1]) {
              // Second party gave this pick
              partiesMap.get(parties[1].rosterId)?.picksGiven.push({
                season: parseInt(pick.season),
                round: pick.round,
              });
              if (parties[0]) {
                partiesMap.get(parties[0].rosterId)?.picksReceived.push({
                  season: parseInt(pick.season),
                  round: pick.round,
                });
              }
            }
            break; // Only process once per pick
          }
        }
      }

      return {
        id: tx.id,
        date: tx.createdAt.toISOString(),
        season: new Date(tx.createdAt).getFullYear(),
        isNew: new Date(tx.createdAt) > oneDayAgo,
        parties: Array.from(partiesMap.values()),
      };
    });

    // Build trades from TradeProposal model
    const tradesFromProposals: RecentTrade[] = acceptedProposals.map((tp) => {
      const partiesMap = new Map<string, TradeParty>();

      // Initialize parties
      for (const party of tp.parties) {
        partiesMap.set(party.rosterId, {
          rosterId: party.rosterId,
          rosterName: party.roster.teamName,
          playersGiven: [],
          playersReceived: [],
          picksGiven: [],
          picksReceived: [],
        });
      }

      // Add assets
      for (const asset of tp.assets) {
        if (asset.assetType === "PLAYER" && asset.player) {
          // Player given by fromRoster
          partiesMap.get(asset.fromRosterId)?.playersGiven.push({
            playerId: asset.player.id,
            sleeperId: asset.player.sleeperId,
            playerName: asset.player.fullName,
            position: asset.player.position,
            team: asset.player.team,
          });
          // Player received by toRoster
          partiesMap.get(asset.toRosterId)?.playersReceived.push({
            playerId: asset.player.id,
            sleeperId: asset.player.sleeperId,
            playerName: asset.player.fullName,
            position: asset.player.position,
            team: asset.player.team,
          });
        } else if (asset.assetType === "DRAFT_PICK" && asset.pickSeason && asset.pickRound) {
          // Pick given
          partiesMap.get(asset.fromRosterId)?.picksGiven.push({
            season: asset.pickSeason,
            round: asset.pickRound,
          });
          // Pick received
          partiesMap.get(asset.toRosterId)?.picksReceived.push({
            season: asset.pickSeason,
            round: asset.pickRound,
          });
        }
      }

      const tradeDate = tp.respondedAt || tp.createdAt;
      return {
        id: tp.id,
        date: tradeDate.toISOString(),
        season: new Date(tradeDate).getFullYear(),
        isNew: new Date(tradeDate) > oneDayAgo,
        parties: Array.from(partiesMap.values()),
      };
    });

    // Combine and deduplicate (prefer proposals over transactions for same trade)
    const allTrades = [...tradesFromProposals, ...tradesFromTransactions];

    // Sort by date descending
    allTrades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Take the most recent
    const trades = allTrades.slice(0, limit);

    // Calculate stats
    const newTradesCount = trades.filter((t) => t.isNew).length;
    const totalPlayersTraded = trades.reduce(
      (sum, t) =>
        sum + t.parties.reduce((pSum, p) => pSum + p.playersGiven.length, 0),
      0
    );
    const totalPicksTraded = trades.reduce(
      (sum, t) =>
        sum + t.parties.reduce((pSum, p) => pSum + p.picksGiven.length, 0),
      0
    );

    const response = NextResponse.json({
      trades,
      stats: {
        totalTrades: trades.length,
        newTrades: newTradesCount,
        playersTraded: totalPlayersTraded,
        picksTraded: totalPicksTraded,
      },
      generatedAt: new Date().toISOString(),
    });
    response.headers.set('Cache-Control', 'private, s-maxage=60, stale-while-revalidate=300');
    return response;
  } catch (error) {
    logger.error("Recent trades fetch error", error);
    return NextResponse.json(
      {
        error: "Failed to fetch recent trades",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
