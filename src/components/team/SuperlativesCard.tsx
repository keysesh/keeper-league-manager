"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/design-tokens";
import {
  TradeArrows,
  TargetPrecision,
  LightningTrade,
  FireStreak,
  PlayoffBracket,
  TrophyPremium,
  WinStreak,
  ShieldKeeper,
} from "@/components/ui/CustomIcons";

export interface Superlative {
  icon: ReactNode;
  label: string;
  value: string;
  season?: number;
  isLeagueBest?: boolean;
}

interface SuperlativesCardProps {
  superlatives: Superlative[];
  className?: string;
}

/**
 * SuperlativesCard - Displays historical achievements in a 2x2 grid
 * Shows stats like Most Trades, Highest Score, Best Record, etc.
 * Gold highlight for league-wide bests
 */
export function SuperlativesCard({ superlatives, className }: SuperlativesCardProps) {
  if (superlatives.length === 0) return null;

  return (
    <div className={cn("bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden", className)}>
      <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
            <TrophyPremium className="w-4 h-4 text-purple-400" />
          </div>
          <h2 className="text-sm sm:text-base font-semibold text-white">Superlatives</h2>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {superlatives.slice(0, 4).map((superlative, index) => (
            <SuperlativeItem key={index} {...superlative} />
          ))}
        </div>
        {superlatives.length > 4 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
            {superlatives.slice(4).map((superlative, index) => (
              <SuperlativeItem key={`extra-${index}`} {...superlative} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SuperlativeItem({ icon, label, value, season, isLeagueBest }: Superlative) {
  return (
    <div
      className={cn(
        "relative p-3 rounded-lg border transition-all duration-200 hover:scale-[1.01]",
        isLeagueBest
          ? "bg-gradient-to-br from-amber-500/15 to-yellow-500/10 border-amber-500/30"
          : "bg-[#131a28] border-white/[0.04]"
      )}
    >
      {isLeagueBest && (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
          <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wider">Best</span>
        </div>
      )}
      <div className={cn(
        "w-7 h-7 rounded-md flex items-center justify-center mb-2",
        isLeagueBest
          ? "bg-amber-500/20 text-amber-400"
          : "bg-slate-500/15 text-slate-400"
      )}>
        {icon}
      </div>
      <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-0.5">
        {label}
      </div>
      <div className={cn(
        "text-sm font-bold",
        isLeagueBest ? "text-amber-300" : "text-white"
      )}>
        {value}
      </div>
      {season && (
        <div className="text-[10px] text-slate-500 mt-0.5">
          {season}
        </div>
      )}
    </div>
  );
}

// Helper to get appropriate icon for a superlative type
export function getSuperlativeIcon(type: string): ReactNode {
  const iconClass = "w-4 h-4";

  switch (type) {
    case "most_trades":
      return <TradeArrows className={iconClass} />;
    case "highest_score":
      return <FireStreak className={iconClass} />;
    case "best_record":
      return <TargetPrecision className={iconClass} />;
    case "trade_master":
      return <LightningTrade className={iconClass} />;
    case "waiver_hawk":
      return <FireStreak className={iconClass} />;
    case "playoff_appearances":
      return <PlayoffBracket className={iconClass} />;
    case "win_streak":
      return <WinStreak className={iconClass} />;
    case "keeper":
      return <ShieldKeeper className={iconClass} />;
    default:
      return <TrophyPremium className={iconClass} />;
  }
}
