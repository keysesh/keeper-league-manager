"use client";

import { Trophy } from "lucide-react";
import { TopScorers } from "./TopScorers";

interface AnalyticsTabsProps {
  leagueId: string;
  userRosterId?: string;
}

/**
 * Analytics section - now simplified to just Top Scorers
 * (Power Rankings shown above, Luck Factor integrated into rankings cards)
 */
export function AnalyticsTabs({ leagueId: _leagueId, userRosterId: _userRosterId }: AnalyticsTabsProps) {
  return (
    <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-500/15 border border-amber-400/30 shadow-lg shadow-amber-500/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-amber-400" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Top Scorers</h3>
            <p className="text-sm text-slate-500">Best performers this season</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="[&>div]:border-0 [&>div]:rounded-none [&>div>div:first-child]:hidden">
        <TopScorers condensed={true} />
      </div>
    </div>
  );
}
