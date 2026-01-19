"use client";

import { useState } from "react";
import { ArrowLeftRight, ChevronDown, ChevronUp } from "lucide-react";
import { TradeHistory } from "@/components/ui/TradeHistory";

interface TradedPlayer {
  playerId: string;
  sleeperId: string;
  playerName: string;
  position: string | null;
}

interface TradeParty {
  rosterId: string;
  rosterName: string | null;
  playersGiven: TradedPlayer[];
  playersReceived: TradedPlayer[];
  picksGiven: Array<{ season: number; round: number }>;
  picksReceived: Array<{ season: number; round: number }>;
}

interface Trade {
  id: string;
  date: string;
  season: number;
  parties: TradeParty[];
}

interface TeamTradeHistoryProps {
  trades: Trade[];
  teamName: string;
  rosterId: string;
  defaultLimit?: number;
}

/**
 * Team Trade History component showing trades involving this specific team
 * Wraps TradeHistory with team-specific filtering and collapsible UI
 */
export function TeamTradeHistory({
  trades,
  teamName,
  rosterId,
  defaultLimit = 5,
}: TeamTradeHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  // Filter trades to only those involving this roster
  const teamTrades = trades.filter((trade) =>
    trade.parties.some((party) => party.rosterId === rosterId)
  );

  if (teamTrades.length === 0) return null;

  // Show limited trades when collapsed
  const displayedTrades = expanded ? teamTrades : teamTrades.slice(0, defaultLimit);
  const hasMore = teamTrades.length > defaultLimit;

  return (
    <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-white">Trade History</h2>
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-blue-500/15 text-blue-400 text-[10px] sm:text-xs font-medium">
              {teamTrades.length}
            </span>
          </div>
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#131a28] hover:bg-[#1a2235] border border-white/[0.06] text-slate-400 hover:text-white text-xs font-medium transition-colors"
            >
              {expanded ? (
                <>
                  Show Less
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Show All ({teamTrades.length})
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
      <div className="p-3 sm:p-5">
        <TradeHistory trades={displayedTrades} highlightRosterId={rosterId} />
      </div>
    </div>
  );
}
