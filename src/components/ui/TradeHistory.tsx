"use client";

import { useMemo } from "react";
import { ArrowLeftRight, Calendar, User, Award } from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";

interface TradedPlayer {
  playerId: string;
  sleeperId: string;
  playerName: string;
  position: string | null;
}

interface TradedPick {
  season: number;
  round: number;
}

interface TradeParty {
  rosterId: string;
  rosterName: string | null;
  playersGiven: TradedPlayer[];
  playersReceived: TradedPlayer[];
  picksGiven: TradedPick[];
  picksReceived: TradedPick[];
}

interface Trade {
  id: string;
  date: string;
  season: number;
  parties: TradeParty[];
}

interface TradeHistoryProps {
  trades: Trade[];
  highlightRosterId?: string;
}

/**
 * Trade History visualization
 * Shows all trades in the league with visual breakdown
 * Features: Season grouping, better styling, hover effects
 */
export function TradeHistory({ trades, highlightRosterId }: TradeHistoryProps) {
  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [trades]);

  // Group trades by season
  const tradesBySeason = useMemo(() => {
    const grouped = new Map<number, typeof trades>();
    for (const trade of sortedTrades) {
      const existing = grouped.get(trade.season) || [];
      existing.push(trade);
      grouped.set(trade.season, existing);
    }
    // Sort seasons descending (most recent first)
    return Array.from(grouped.entries()).sort((a, b) => b[0] - a[0]);
  }, [sortedTrades]);

  // Trade stats
  const stats = useMemo(() => {
    const playersTradedCount = trades.reduce(
      (sum, t) => sum + t.parties.reduce((pSum, p) => pSum + p.playersGiven.length, 0),
      0
    );
    const picksTradedCount = trades.reduce(
      (sum, t) => sum + t.parties.reduce((pSum, p) => pSum + p.picksGiven.length, 0),
      0
    );

    // Most active trader
    const tradeCountByTeam = new Map<string, { name: string; count: number }>();
    for (const trade of trades) {
      for (const party of trade.parties) {
        const existing = tradeCountByTeam.get(party.rosterId) || { name: party.rosterName || "Unknown", count: 0 };
        existing.count++;
        tradeCountByTeam.set(party.rosterId, existing);
      }
    }
    const mostActive = [...tradeCountByTeam.entries()]
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)[0];

    return {
      totalTrades: trades.length,
      playersTradedCount,
      picksTradedCount,
      mostActiveTrader: mostActive,
    };
  }, [trades]);

  if (trades.length === 0) {
    return (
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-lg p-6 text-center">
        <ArrowLeftRight className="w-10 h-10 text-slate-600 mx-auto mb-2" />
        <p className="text-slate-400 font-medium text-sm">No trades recorded</p>
        <p className="text-xs text-slate-600 mt-1">Trades will appear here once they occur</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <div className="bg-[#131a28] border border-white/[0.04] rounded-md p-2 text-center">
          <div className="text-lg font-bold text-white">{stats.totalTrades}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">Total Trades</div>
        </div>
        <div className="bg-[#131a28] border border-white/[0.04] rounded-md p-2 text-center">
          <div className="text-lg font-bold text-blue-400">{stats.playersTradedCount}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">Players Moved</div>
        </div>
        <div className="bg-[#131a28] border border-white/[0.04] rounded-md p-2 text-center">
          <div className="text-lg font-bold text-emerald-400">{stats.picksTradedCount}</div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">Picks Traded</div>
        </div>
        {stats.mostActiveTrader && (
          <div className="bg-[#131a28] border border-white/[0.04] rounded-md p-2 text-center">
            <div className="flex items-center justify-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-sm font-bold text-amber-400">{stats.mostActiveTrader.count}</span>
            </div>
            <div className="text-[9px] text-slate-400 truncate mt-0.5">{stats.mostActiveTrader.name}</div>
            <div className="text-[8px] text-slate-600">Most Active</div>
          </div>
        )}
      </div>

      {/* Trade list - Grouped by season */}
      <div className="bg-[#0d1420] border border-white/[0.06] rounded-lg overflow-hidden">
        <div className="px-3 py-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" />
            <h3 className="font-semibold text-white text-sm">Trade History</h3>
          </div>
        </div>

        <div>
          {tradesBySeason.map(([season, seasonTrades]) => (
            <div key={season}>
              {/* Season header */}
              <div className="px-3 py-2 bg-[#0a0f17] border-b border-white/[0.04] sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">{season} Season</span>
                  <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-slate-500/10">
                    {seasonTrades.length} trade{seasonTrades.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Trades in this season */}
              <div className="divide-y divide-white/[0.04]">
                {seasonTrades.map((trade) => {
                  const isHighlighted = trade.parties.some(p => p.rosterId === highlightRosterId);

                  return (
                    <div
                      key={trade.id}
                      className={`p-3 transition-colors hover:bg-white/[0.02] ${isHighlighted ? "bg-blue-500/5" : ""}`}
                    >
                      {/* Trade header - just date now since season is in header */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(trade.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>

                      {/* Trade parties */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {trade.parties.map((party) => (
                          <div
                            key={party.rosterId}
                            className={`rounded-lg p-2.5 transition-all hover:border-white/[0.08] ${
                              party.rosterId === highlightRosterId
                                ? "bg-blue-500/10 border border-blue-500/25"
                                : "bg-[#131a28] border border-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/[0.04]">
                              <User className="w-3 h-3 text-slate-500" />
                              <span className="text-xs font-medium text-white truncate">
                                {party.rosterName || `Team ${party.rosterId.slice(0, 6)}`}
                              </span>
                            </div>

                            {/* Sent */}
                            {(party.playersGiven.length > 0 || party.picksGiven.length > 0) && (
                              <div className="mb-2">
                                <span className="text-[8px] text-red-400 uppercase tracking-wider font-semibold">Sent</span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {party.playersGiven.map((player) => (
                                    <div key={player.playerId} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/5 border border-red-500/10">
                                      <PlayerAvatar sleeperId={player.sleeperId} name={player.playerName} size="xs" />
                                      <PositionBadge position={player.position} size="xs" />
                                      <span className="text-[11px] text-slate-300">{player.playerName}</span>
                                    </div>
                                  ))}
                                  {party.picksGiven.map((pick, i) => (
                                    <div key={i} className="inline-flex text-[11px] text-red-300/70 px-1.5 py-0.5 rounded bg-red-500/5 border border-red-500/10">
                                      {pick.season} Rd {pick.round}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Received */}
                            {(party.playersReceived.length > 0 || party.picksReceived.length > 0) && (
                              <div>
                                <span className="text-[8px] text-emerald-400 uppercase tracking-wider font-semibold">Received</span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {party.playersReceived.map((player) => (
                                    <div key={player.playerId} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/5 border border-emerald-500/10">
                                      <PlayerAvatar sleeperId={player.sleeperId} name={player.playerName} size="xs" />
                                      <PositionBadge position={player.position} size="xs" />
                                      <span className="text-[11px] text-slate-300">{player.playerName}</span>
                                    </div>
                                  ))}
                                  {party.picksReceived.map((pick, i) => (
                                    <div key={i} className="inline-flex text-[11px] text-emerald-300/70 px-1.5 py-0.5 rounded bg-emerald-500/5 border border-emerald-500/10">
                                      {pick.season} Rd {pick.round}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
