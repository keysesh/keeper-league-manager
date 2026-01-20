"use client";

import { useMemo } from "react";
import { ArrowLeftRight, Calendar, Award } from "lucide-react";
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
 * Trade History visualization - Exchange View
 * Shows all trades with a compact Team A ⇄ Team B layout
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

              {/* Trades in this season - Exchange View */}
              <div className="divide-y divide-white/[0.04]">
                {seasonTrades.map((trade) => {
                  const isHighlighted = trade.parties.some(p => p.rosterId === highlightRosterId);

                  // For 2-party trades, show exchange view
                  if (trade.parties.length === 2) {
                    const [partyA, partyB] = trade.parties;
                    const partyAHighlighted = partyA.rosterId === highlightRosterId;
                    const partyBHighlighted = partyB.rosterId === highlightRosterId;

                    return (
                      <div
                        key={trade.id}
                        className={`p-3 transition-colors hover:bg-white/[0.02] ${isHighlighted ? "bg-blue-500/5" : ""}`}
                      >
                        {/* Date */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(trade.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        </div>

                        {/* Exchange View: Team A | ⇄ | Team B */}
                        <div className="flex items-stretch gap-2">
                          {/* Team A's items (what they gave) */}
                          <div className={`flex-1 min-w-0 rounded-lg p-2 ${partyAHighlighted ? "bg-blue-500/10 border border-blue-500/20" : "bg-[#131a28]"}`}>
                            <div className="text-[10px] font-medium text-slate-400 mb-1.5 truncate">
                              {partyA.rosterName || `Team ${partyA.rosterId.slice(0, 6)}`}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {partyA.playersGiven.map((player) => (
                                <div key={player.playerId} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04]">
                                  <PlayerAvatar sleeperId={player.sleeperId} name={player.playerName} size="xs" />
                                  <PositionBadge position={player.position} size="xs" />
                                  <span className="text-[10px] text-slate-300 truncate max-w-[80px]">{player.playerName}</span>
                                </div>
                              ))}
                              {partyA.picksGiven.map((pick, i) => (
                                <div key={i} className="inline-flex text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-white/[0.04]">
                                  '{String(pick.season).slice(-2)} R{pick.round}
                                </div>
                              ))}
                              {partyA.playersGiven.length === 0 && partyA.picksGiven.length === 0 && (
                                <span className="text-[10px] text-slate-500 italic">Nothing</span>
                              )}
                            </div>
                          </div>

                          {/* Exchange Icon */}
                          <div className="flex items-center justify-center px-1">
                            <ArrowLeftRight className="w-4 h-4 text-slate-500" />
                          </div>

                          {/* Team B's items (what they gave) */}
                          <div className={`flex-1 min-w-0 rounded-lg p-2 ${partyBHighlighted ? "bg-blue-500/10 border border-blue-500/20" : "bg-[#131a28]"}`}>
                            <div className="text-[10px] font-medium text-slate-400 mb-1.5 truncate">
                              {partyB.rosterName || `Team ${partyB.rosterId.slice(0, 6)}`}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {partyB.playersGiven.map((player) => (
                                <div key={player.playerId} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04]">
                                  <PlayerAvatar sleeperId={player.sleeperId} name={player.playerName} size="xs" />
                                  <PositionBadge position={player.position} size="xs" />
                                  <span className="text-[10px] text-slate-300 truncate max-w-[80px]">{player.playerName}</span>
                                </div>
                              ))}
                              {partyB.picksGiven.map((pick, i) => (
                                <div key={i} className="inline-flex text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-white/[0.04]">
                                  '{String(pick.season).slice(-2)} R{pick.round}
                                </div>
                              ))}
                              {partyB.playersGiven.length === 0 && partyB.picksGiven.length === 0 && (
                                <span className="text-[10px] text-slate-500 italic">Nothing</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Multi-party trades (3+ parties) - show compact list
                  return (
                    <div
                      key={trade.id}
                      className={`p-3 transition-colors hover:bg-white/[0.02] ${isHighlighted ? "bg-blue-500/5" : ""}`}
                    >
                      {/* Date */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(trade.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400">
                          {trade.parties.length}-way trade
                        </span>
                      </div>

                      {/* Multi-party exchange */}
                      <div className="space-y-2">
                        {trade.parties.map((party) => {
                          const partyHighlighted = party.rosterId === highlightRosterId;
                          return (
                            <div
                              key={party.rosterId}
                              className={`rounded-lg p-2 ${partyHighlighted ? "bg-blue-500/10 border border-blue-500/20" : "bg-[#131a28]"}`}
                            >
                              <div className="text-[10px] font-medium text-slate-400 mb-1 truncate">
                                {party.rosterName || `Team ${party.rosterId.slice(0, 6)}`}
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                {/* Given */}
                                {(party.playersGiven.length > 0 || party.picksGiven.length > 0) && (
                                  <>
                                    <span className="text-[8px] text-red-400 font-medium">SENT:</span>
                                    {party.playersGiven.map((player) => (
                                      <div key={player.playerId} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-500/10 border border-red-500/10">
                                        <PositionBadge position={player.position} size="xs" />
                                        <span className="text-[9px] text-slate-300">{player.playerName}</span>
                                      </div>
                                    ))}
                                    {party.picksGiven.map((pick, i) => (
                                      <span key={i} className="text-[9px] text-red-300/70 px-1 py-0.5 rounded bg-red-500/10">
                                        '{String(pick.season).slice(-2)} R{pick.round}
                                      </span>
                                    ))}
                                  </>
                                )}
                                {/* Received */}
                                {(party.playersReceived.length > 0 || party.picksReceived.length > 0) && (
                                  <>
                                    <span className="text-[8px] text-emerald-400 font-medium ml-2">GOT:</span>
                                    {party.playersReceived.map((player) => (
                                      <div key={player.playerId} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/10">
                                        <PositionBadge position={player.position} size="xs" />
                                        <span className="text-[9px] text-slate-300">{player.playerName}</span>
                                      </div>
                                    ))}
                                    {party.picksReceived.map((pick, i) => (
                                      <span key={i} className="text-[9px] text-emerald-300/70 px-1 py-0.5 rounded bg-emerald-500/10">
                                        '{String(pick.season).slice(-2)} R{pick.round}
                                      </span>
                                    ))}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
