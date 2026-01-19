"use client";

import useSWR from "swr";
import { ArrowLeftRight, Sparkles, Calendar, ArrowRight } from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";

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
 * Recent Trades component
 * Shows the latest trades in the league
 */
export function RecentTrades({ leagueId, userRosterId, limit = 5 }: RecentTradesProps) {
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
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  if (isLoading) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden animate-pulse">
        <div className="px-4 py-4 border-b border-[#2a2a2a]">
          <div className="h-8 w-32 bg-[#2a2a2a] rounded" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-[#2a2a2a] rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.trades) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <ArrowLeftRight className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-base text-gray-400 font-medium">No trades yet</p>
        <p className="text-sm text-gray-600 mt-1">Trades will appear here when they happen</p>
      </div>
    );
  }

  const { trades, stats } = data;

  if (trades.length === 0) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <ArrowLeftRight className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-base text-gray-400 font-medium">No trades yet</p>
        <p className="text-sm text-gray-600 mt-1">Trades will appear here when they happen</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Recent Trades</h3>
              <p className="text-sm text-gray-500">
                {stats.totalTrades} trade{stats.totalTrades !== 1 ? "s" : ""} · {stats.playersTraded} players · {stats.picksTraded} picks
              </p>
            </div>
          </div>
          {stats.newTrades > 0 && (
            <span className="flex items-center gap-1 text-sm px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded font-medium">
              <Sparkles className="w-4 h-4" />
              {stats.newTrades} new
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-[#2a2a2a]">
        {trades.map((trade) => {
          const isInvolved = trade.parties.some(p => p.rosterId === userRosterId);
          const [teamA, teamB] = trade.parties;

          return (
            <div
              key={trade.id}
              className={`p-4 sm:p-5 ${isInvolved ? "bg-blue-500/5" : ""}`}
            >
              {/* Trade header */}
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-500">
                  {new Date(trade.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: trade.season !== new Date().getFullYear() ? "numeric" : undefined,
                  })}
                </span>
                {trade.isNew && (
                  <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded font-bold">
                    NEW
                  </span>
                )}
              </div>

              {/* Horizontal trade flow */}
              {teamA && teamB ? (
                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                  {/* Team A side */}
                  <div className={`flex-1 rounded-lg p-3 sm:p-4 ${
                    teamA.rosterId === userRosterId
                      ? "bg-blue-500/10 border border-blue-500/30"
                      : "bg-[#222] border border-[#2a2a2a]"
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-semibold text-white truncate">
                        {teamA.rosterName || "Team"}
                      </span>
                      {teamA.rosterId === userRosterId && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded font-bold flex-shrink-0">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {teamA.playersGiven.map((player) => (
                        <div key={player.playerId} className="flex items-center gap-1.5">
                          <PositionBadge position={player.position} size="xs" />
                          <span className="text-sm text-gray-200 truncate">{player.playerName}</span>
                        </div>
                      ))}
                      {teamA.picksGiven.map((pick, i) => (
                        <div key={i} className="text-sm text-gray-400 pl-1">
                          &apos;{String(pick.season).slice(-2)} Round {pick.round}
                        </div>
                      ))}
                      {teamA.playersGiven.length === 0 && teamA.picksGiven.length === 0 && (
                        <span className="text-sm text-gray-500 italic">Nothing sent</span>
                      )}
                    </div>
                  </div>

                  {/* Exchange arrows */}
                  <div className="flex sm:flex-col items-center justify-center gap-1 py-1 sm:py-0 sm:px-1">
                    <ArrowRight className="w-4 h-4 text-gray-500 rotate-90 sm:rotate-0" />
                    <ArrowRight className="w-4 h-4 text-gray-500 -rotate-90 sm:rotate-180" />
                  </div>

                  {/* Team B side */}
                  <div className={`flex-1 rounded-lg p-3 sm:p-4 ${
                    teamB.rosterId === userRosterId
                      ? "bg-blue-500/10 border border-blue-500/30"
                      : "bg-[#222] border border-[#2a2a2a]"
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-semibold text-white truncate">
                        {teamB.rosterName || "Team"}
                      </span>
                      {teamB.rosterId === userRosterId && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-500 text-white rounded font-bold flex-shrink-0">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {teamB.playersGiven.map((player) => (
                        <div key={player.playerId} className="flex items-center gap-1.5">
                          <PositionBadge position={player.position} size="xs" />
                          <span className="text-sm text-gray-200 truncate">{player.playerName}</span>
                        </div>
                      ))}
                      {teamB.picksGiven.map((pick, i) => (
                        <div key={i} className="text-sm text-gray-400 pl-1">
                          &apos;{String(pick.season).slice(-2)} Round {pick.round}
                        </div>
                      ))}
                      {teamB.playersGiven.length === 0 && teamB.picksGiven.length === 0 && (
                        <span className="text-sm text-gray-500 italic">Nothing sent</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Fallback for single-party trades (rare) */
                <div className="text-sm text-gray-500">Trade data incomplete</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
