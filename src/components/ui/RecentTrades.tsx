"use client";

import useSWR from "swr";
import { ArrowLeftRight, Sparkles, Calendar, User } from "lucide-react";
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
        <div className="px-4 py-3 border-b border-[#2a2a2a]">
          <div className="h-8 w-32 bg-[#2a2a2a] rounded" />
        </div>
        <div className="p-3 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-[#2a2a2a] rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.trades) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <ArrowLeftRight className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 font-medium">No trades yet</p>
        <p className="text-xs text-gray-600 mt-1">Trades will appear here when they happen</p>
      </div>
    );
  }

  const { trades, stats } = data;

  if (trades.length === 0) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <ArrowLeftRight className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 font-medium">No trades yet</p>
        <p className="text-xs text-gray-600 mt-1">Trades will appear here when they happen</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Recent Trades</h3>
              <p className="text-[10px] text-gray-500">
                {stats.totalTrades} trade{stats.totalTrades !== 1 ? "s" : ""} · {stats.playersTraded} players · {stats.picksTraded} picks
              </p>
            </div>
          </div>
          {stats.newTrades > 0 && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-1 bg-amber-500/20 text-amber-400 rounded font-medium">
              <Sparkles className="w-3 h-3" />
              {stats.newTrades} new
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-[#2a2a2a]">
        {trades.map((trade) => {
          const isInvolved = trade.parties.some(p => p.rosterId === userRosterId);

          return (
            <div
              key={trade.id}
              className={`p-3 ${isInvolved ? "bg-blue-500/5" : ""}`}
            >
              {/* Trade header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-gray-500" />
                  <span className="text-[10px] text-gray-500">
                    {new Date(trade.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: trade.season !== new Date().getFullYear() ? "numeric" : undefined,
                    })}
                  </span>
                  {trade.isNew && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded font-bold">
                      NEW
                    </span>
                  )}
                </div>
              </div>

              {/* Trade parties */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {trade.parties.map((party) => (
                  <div
                    key={party.rosterId}
                    className={`rounded-md p-2 ${
                      party.rosterId === userRosterId
                        ? "bg-blue-500/10 border border-blue-500/20"
                        : "bg-[#222]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <User className="w-2.5 h-2.5 text-gray-500" />
                      <span className="text-xs font-medium text-white truncate">
                        {party.rosterName || "Unknown Team"}
                      </span>
                      {party.rosterId === userRosterId && (
                        <span className="text-[8px] px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded font-bold">
                          YOU
                        </span>
                      )}
                    </div>

                    {/* Sent */}
                    {(party.playersGiven.length > 0 || party.picksGiven.length > 0) && (
                      <div className="mb-1">
                        <span className="text-[8px] text-red-400 uppercase tracking-wider">Sent</span>
                        <div className="mt-0.5 space-y-0.5">
                          {party.playersGiven.map((player) => (
                            <div key={player.playerId} className="flex items-center gap-1">
                              <PositionBadge position={player.position} size="xs" />
                              <span className="text-[10px] text-gray-300 truncate">{player.playerName}</span>
                            </div>
                          ))}
                          {party.picksGiven.map((pick, i) => (
                            <div key={i} className="text-[10px] text-gray-400">
                              {pick.season} Rd {pick.round}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Received */}
                    {(party.playersReceived.length > 0 || party.picksReceived.length > 0) && (
                      <div>
                        <span className="text-[8px] text-emerald-400 uppercase tracking-wider">Got</span>
                        <div className="mt-0.5 space-y-0.5">
                          {party.playersReceived.map((player) => (
                            <div key={player.playerId} className="flex items-center gap-1">
                              <PositionBadge position={player.position} size="xs" />
                              <span className="text-[10px] text-gray-300 truncate">{player.playerName}</span>
                            </div>
                          ))}
                          {party.picksReceived.map((pick, i) => (
                            <div key={i} className="text-[10px] text-gray-400">
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
  );
}
