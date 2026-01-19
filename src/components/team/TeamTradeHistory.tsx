"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { TradeArrows } from "@/components/ui/CustomIcons";
import { TradeHistory } from "@/components/ui/TradeHistory";
import { cn } from "@/lib/design-tokens";
import Link from "next/link";

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
  variant?: "full" | "compact";
  viewAllHref?: string;
  className?: string;
}

/**
 * Team Trade History component showing trades involving this specific team
 * Supports:
 * - full: Original expandable list (default)
 * - compact: Summary card with "View All" link for bento grids
 */
export function TeamTradeHistory({
  trades,
  teamName: _teamName,
  rosterId,
  defaultLimit = 5,
  variant = "full",
  viewAllHref,
  className,
}: TeamTradeHistoryProps) {
  // teamName is kept for potential future use in "View All" links
  void _teamName;
  const [expanded, setExpanded] = useState(false);

  // Filter trades to only those involving this roster
  const teamTrades = trades.filter((trade) =>
    trade.parties.some((party) => party.rosterId === rosterId)
  );

  if (teamTrades.length === 0) return null;

  // Count assets involved in trades
  const totalPlayersTraded = teamTrades.reduce((sum, trade) => {
    const teamParty = trade.parties.find(p => p.rosterId === rosterId);
    if (!teamParty) return sum;
    return sum + teamParty.playersGiven.length + teamParty.playersReceived.length;
  }, 0);

  const totalPicksTraded = teamTrades.reduce((sum, trade) => {
    const teamParty = trade.parties.find(p => p.rosterId === rosterId);
    if (!teamParty) return sum;
    return sum + teamParty.picksGiven.length + teamParty.picksReceived.length;
  }, 0);

  // Compact variant - summary card
  if (variant === "compact") {
    const latestTrade = teamTrades[0];
    const latestTradeDate = latestTrade ? new Date(latestTrade.date) : null;
    const formattedDate = latestTradeDate
      ? latestTradeDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : null;

    return (
      <div className={cn("bg-[#0d1420] border border-white/[0.06] rounded-xl p-3", className)}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-md bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <TradeArrows className="w-3 h-3 text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Trade Activity</h3>
        </div>

        {/* Compact stats */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Total Trades</span>
            <span className="text-xs font-bold text-white">{teamTrades.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Players Traded</span>
            <span className="text-xs font-medium text-slate-300">{totalPlayersTraded}</span>
          </div>
          {totalPicksTraded > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Picks Traded</span>
              <span className="text-xs font-medium text-slate-300">{totalPicksTraded}</span>
            </div>
          )}
          {formattedDate && (
            <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
              <span className="text-[11px] text-slate-500">Last Trade</span>
              <span className="text-[11px] text-slate-400">{formattedDate}</span>
            </div>
          )}
        </div>

        {/* View All link */}
        {viewAllHref && teamTrades.length > 0 && (
          <Link
            href={viewAllHref}
            className="flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-white/[0.04] text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            View All Trades
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>
    );
  }

  // Full variant (default)
  const displayedTrades = expanded ? teamTrades : teamTrades.slice(0, defaultLimit);
  const hasMore = teamTrades.length > defaultLimit;

  return (
    <div className={cn("bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden", className)}>
      <div className="px-3 sm:px-4 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <TradeArrows className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Trade History</h2>
            <span className="px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-400 text-[10px] font-medium">
              {teamTrades.length}
            </span>
          </div>
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#131a28] hover:bg-[#1a2235] border border-white/[0.06] text-slate-400 hover:text-white text-[11px] font-medium transition-colors"
            >
              {expanded ? (
                <>
                  Show Less
                  <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  Show All ({teamTrades.length})
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
      <div className="p-2 sm:p-3">
        <TradeHistory trades={displayedTrades} highlightRosterId={rosterId} />
      </div>
    </div>
  );
}
