"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { ArrowLeftRight, Sparkles, ChevronDown, ChevronUp, ArrowRight, User, Users } from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { cn } from "@/lib/design-tokens";

const fetcher = (url: string) => fetch(url).then(res => res.json());

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
  isNew: boolean;
  parties: TradeParty[];
}

interface RecentTradesProps {
  leagueId: string;
  userRosterId?: string;
  limit?: number;
}

/**
 * Recent Trades component - Condensed horizontal card layout
 * Shows the latest trades in the league with click-to-expand
 * Defaults to showing user's trades when userRosterId is provided
 */
export function RecentTrades({ leagueId, userRosterId, limit = 3 }: RecentTradesProps) {
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [filter, setFilter] = useState<"my" | "all">(userRosterId ? "my" : "all");

  const { data, isLoading, error } = useSWR<{
    trades: RecentTrade[];
    stats: {
      totalTrades: number;
      newTrades: number;
      playersTraded: number;
      picksTraded: number;
    };
  }>(
    `/api/leagues/${leagueId}/recent-trades?limit=${limit}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  // All hooks must be called before any early returns
  const trades = data?.trades ?? [];
  const stats = data?.stats;

  // Filter trades based on user selection
  const filteredTrades = useMemo(() => {
    if (filter === "all" || !userRosterId) return trades;
    return trades.filter(trade =>
      trade.parties.some(p => p.rosterId === userRosterId)
    );
  }, [trades, filter, userRosterId]);

  // Count user's trades for display
  const myTradesCount = useMemo(() => {
    if (!userRosterId) return 0;
    return trades.filter(trade =>
      trade.parties.some(p => p.rosterId === userRosterId)
    ).length;
  }, [trades, userRosterId]);

  if (isLoading) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden animate-pulse">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="h-6 w-32 bg-white/[0.05] rounded" />
        </div>
        <div className="p-3 space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-white/[0.05] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.trades) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-6 text-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/25 to-blue-600/15 border border-blue-400/30 shadow-lg shadow-blue-500/10 flex items-center justify-center mx-auto mb-3">
          <ArrowLeftRight className="w-5 h-5 text-blue-400" strokeWidth={2} />
        </div>
        <p className="text-sm text-slate-400 font-medium">No trades yet</p>
        <p className="text-xs text-slate-600 mt-1">Trades will appear here</p>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-6 text-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/25 to-blue-600/15 border border-blue-400/30 shadow-lg shadow-blue-500/10 flex items-center justify-center mx-auto mb-3">
          <ArrowLeftRight className="w-5 h-5 text-blue-400" strokeWidth={2} />
        </div>
        <p className="text-sm text-slate-400 font-medium">No trades yet</p>
        <p className="text-xs text-slate-600 mt-1">Trades will appear here</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/25 to-blue-600/15 border border-blue-400/30 shadow-lg shadow-blue-500/10 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4 text-blue-400" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Recent Trades</h3>
              <p className="text-xs text-slate-500">
                {filter === "my" && userRosterId
                  ? `${myTradesCount} of your trade${myTradesCount !== 1 ? "s" : ""}`
                  : `${stats!.totalTrades} trade${stats!.totalTrades !== 1 ? "s" : ""} · ${stats!.playersTraded} players`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats!.newTrades > 0 && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full font-medium">
                <Sparkles className="w-3 h-3" />
                {stats!.newTrades}
              </span>
            )}
            {/* Filter Toggle */}
            {userRosterId && (
              <div className="flex rounded-lg bg-white/[0.05] p-0.5">
                <button
                  onClick={() => setFilter("my")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
                    filter === "my"
                      ? "bg-blue-500/20 text-blue-400"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  <User className="w-3 h-3" />
                  My
                </button>
                <button
                  onClick={() => setFilter("all")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
                    filter === "all"
                      ? "bg-blue-500/20 text-blue-400"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  <Users className="w-3 h-3" />
                  All
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Condensed trade cards */}
      <div className="p-2 space-y-1.5">
        {filteredTrades.length === 0 && filter === "my" && (
          <div className="py-6 text-center">
            <p className="text-sm text-slate-400">No trades involving your team yet</p>
            <button
              onClick={() => setFilter("all")}
              className="text-xs text-blue-400 hover:text-blue-300 mt-1"
            >
              View all league trades
            </button>
          </div>
        )}
        {filteredTrades.map((trade) => {
          const isInvolved = trade.parties.some(p => p.rosterId === userRosterId);
          const [teamA, teamB] = trade.parties;
          const isExpanded = expandedTrade === trade.id;

          // Get summary text for collapsed view
          const teamAAssets = [...teamA.playersGiven.map(p => p.playerName), ...teamA.picksGiven.map(p => `'${String(p.season).slice(-2)} R${p.round}`)];
          const teamBAssets = [...teamB.playersGiven.map(p => p.playerName), ...teamB.picksGiven.map(p => `'${String(p.season).slice(-2)} R${p.round}`)];

          return (
            <div key={trade.id}>
              {/* Condensed horizontal card */}
              <button
                onClick={() => setExpandedTrade(isExpanded ? null : trade.id)}
                className={cn(
                  "w-full text-left rounded-lg p-2.5 transition-all",
                  isInvolved
                    ? "bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20"
                    : "bg-white/[0.02] hover:bg-white/[0.04] border border-transparent"
                )}
              >
                <div className="flex items-center gap-2">
                  {/* Trade info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-500">
                        {new Date(trade.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                      {trade.isNew && (
                        <span className="text-[10px] px-1 py-0.5 bg-amber-500/20 text-amber-400 rounded font-bold">
                          NEW
                        </span>
                      )}
                      {isInvolved && (
                        <span className="text-[10px] px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded font-bold">
                          YOU
                        </span>
                      )}
                    </div>

                    {/* Horizontal trade summary */}
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-medium text-white truncate max-w-[80px]">
                        {teamA.rosterName?.split(" ")[0] || "Team A"}
                      </span>
                      <span className="text-slate-500 text-xs truncate max-w-[60px]">
                        ({teamAAssets[0] || "—"}{teamAAssets.length > 1 ? ` +${teamAAssets.length - 1}` : ""})
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                      <span className="font-medium text-white truncate max-w-[80px]">
                        {teamB.rosterName?.split(" ")[0] || "Team B"}
                      </span>
                      <span className="text-slate-500 text-xs truncate max-w-[60px]">
                        ({teamBAssets[0] || "—"}{teamBAssets.length > 1 ? ` +${teamBAssets.length - 1}` : ""})
                      </span>
                    </div>
                  </div>

                  {/* Expand indicator */}
                  <div className="flex-shrink-0 text-slate-500">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && teamA && teamB && (
                <div className="mt-1.5 mx-1 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Team A sends */}
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-medium">
                        {teamA.rosterName || "Team"} sends
                      </div>
                      <div className="space-y-1">
                        {teamA.playersGiven.map((player) => (
                          <div key={player.playerId} className="flex items-center gap-1.5">
                            <PositionBadge position={player.position} size="xs" />
                            <span className="text-xs text-white truncate">{player.playerName}</span>
                          </div>
                        ))}
                        {teamA.picksGiven.map((pick, i) => (
                          <div key={i} className="text-xs text-slate-400">
                            &apos;{String(pick.season).slice(-2)} Round {pick.round}
                          </div>
                        ))}
                        {teamA.playersGiven.length === 0 && teamA.picksGiven.length === 0 && (
                          <span className="text-xs text-slate-500 italic">Nothing</span>
                        )}
                      </div>
                    </div>

                    {/* Team B sends */}
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-medium">
                        {teamB.rosterName || "Team"} sends
                      </div>
                      <div className="space-y-1">
                        {teamB.playersGiven.map((player) => (
                          <div key={player.playerId} className="flex items-center gap-1.5">
                            <PositionBadge position={player.position} size="xs" />
                            <span className="text-xs text-white truncate">{player.playerName}</span>
                          </div>
                        ))}
                        {teamB.picksGiven.map((pick, i) => (
                          <div key={i} className="text-xs text-slate-400">
                            &apos;{String(pick.season).slice(-2)} Round {pick.round}
                          </div>
                        ))}
                        {teamB.playersGiven.length === 0 && teamB.picksGiven.length === 0 && (
                          <span className="text-xs text-slate-500 italic">Nothing</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
