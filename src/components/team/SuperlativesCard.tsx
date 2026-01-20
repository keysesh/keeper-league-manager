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

export type BadgeTier = 'gold' | 'silver' | 'bronze' | 'blue';

export interface Superlative {
  icon: ReactNode;
  label: string;
  value: string;
  season?: number;
  isLeagueBest?: boolean;
  tier?: BadgeTier;  // Tiered badge styling (gold/silver/bronze/blue)
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
      <div className="px-3 sm:px-4 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
            <TrophyPremium className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-400" />
          </div>
          <h2 className="text-sm font-semibold text-white">Superlatives</h2>
        </div>
      </div>
      <div className="p-2 sm:p-3">
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          {superlatives.map((superlative, index) => (
            <SuperlativeItem key={index} {...superlative} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Tier-based styling configuration
const tierStyles: Record<BadgeTier, { bg: string; border: string; text: string; icon: string; badge?: string }> = {
  gold: {
    bg: "bg-gradient-to-br from-amber-500/15 to-yellow-500/10",
    border: "border-amber-500/30",
    text: "text-amber-300",
    icon: "bg-amber-500/20 text-amber-400",
    badge: "bg-amber-500/20 border-amber-500/30 text-amber-400",
  },
  silver: {
    bg: "bg-gradient-to-br from-slate-400/15 to-slate-300/10",
    border: "border-slate-400/30",
    text: "text-slate-200",
    icon: "bg-slate-400/20 text-slate-300",
    badge: "bg-slate-400/20 border-slate-400/30 text-slate-300",
  },
  bronze: {
    bg: "bg-gradient-to-br from-orange-600/15 to-amber-700/10",
    border: "border-orange-600/30",
    text: "text-orange-300",
    icon: "bg-orange-600/20 text-orange-400",
    badge: "bg-orange-600/20 border-orange-600/30 text-orange-400",
  },
  blue: {
    bg: "bg-gradient-to-br from-blue-500/15 to-cyan-500/10",
    border: "border-blue-500/30",
    text: "text-blue-300",
    icon: "bg-blue-500/20 text-blue-400",
  },
};

function SuperlativeItem({ icon, label, value, season, isLeagueBest, tier }: Superlative) {
  // isLeagueBest takes priority for gold styling
  const effectiveTier = isLeagueBest ? 'gold' : tier;
  const style = effectiveTier ? tierStyles[effectiveTier] : null;

  return (
    <div
      className={cn(
        "relative p-2 sm:p-2.5 rounded-md border transition-all duration-200",
        style
          ? `${style.bg} ${style.border}`
          : "bg-[#131a28] border-white/[0.04]"
      )}
    >
      {isLeagueBest && (
        <div className="absolute top-1 right-1 px-1 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
          <span className="text-[7px] font-bold text-amber-400 uppercase tracking-wider">Best</span>
        </div>
      )}
      {tier && !isLeagueBest && tierStyles[tier].badge && (
        <div className={cn(
          "absolute top-1 right-1 px-1 py-0.5 rounded border",
          tierStyles[tier].badge
        )}>
          <span className="text-[7px] font-bold uppercase tracking-wider">
            {tier === 'gold' ? '1st' : tier === 'silver' ? '2nd' : tier === 'bronze' ? '3rd' : ''}
          </span>
        </div>
      )}
      <div className={cn(
        "w-5 h-5 rounded flex items-center justify-center mb-1.5",
        style
          ? style.icon
          : "bg-slate-500/15 text-slate-400"
      )}>
        {icon}
      </div>
      <div className="text-[9px] text-slate-500 font-medium uppercase tracking-wide mb-0.5 leading-tight">
        {label}
      </div>
      <div className={cn(
        "text-xs sm:text-sm font-bold leading-tight",
        style ? style.text : "text-white"
      )}>
        {value}
      </div>
      {season && (
        <div className="text-[9px] text-slate-500 mt-0.5">
          {season}
        </div>
      )}
    </div>
  );
}

// Helper to get appropriate icon for a superlative type
export function getSuperlativeIcon(type: string): ReactNode {
  const iconClass = "w-3.5 h-3.5";

  switch (type) {
    // Legacy types
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
    case "champion":
      return <TrophyPremium className={iconClass} />;

    // Seasons badges
    case "seasons_veteran":
    case "seasons_regular":
    case "seasons_newcomer":
      return <ShieldKeeper className={iconClass} />;

    // Trades badges
    case "trades_master":
      return <LightningTrade className={iconClass} />;
    case "trades_dealer":
    case "trades_active":
    case "trades_first":
      return <TradeArrows className={iconClass} />;

    // Wins badges
    case "wins_dominant":
    case "wins_winner":
    case "wins_competitor":
    case "wins_club500":
      return <WinStreak className={iconClass} />;

    // Scoring badges
    case "scoring_elite":
    case "scoring_prolific":
    case "scoring_scorer":
      return <FireStreak className={iconClass} />;

    // Playoffs badges
    case "playoffs_king":
    case "playoffs_regular":
    case "playoffs_contender":
      return <PlayoffBracket className={iconClass} />;

    default:
      return <TrophyPremium className={iconClass} />;
  }
}
