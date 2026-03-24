"use client";

import Link from "next/link";
import { Crown, Lock, TrendingUp, ChevronRight } from "lucide-react";

interface Keeper {
  id: string;
  player: {
    fullName: string;
    position: string;
    team: string;
  };
  type: "REGULAR" | "FRANCHISE";
  finalCost: number;
  yearsKept?: number;
}

interface KeeperCardProps {
  keeper: Keeper;
  showDetails?: boolean;
}

const positionConfig: Record<string, { gradient: string; glow: string; text: string; bg: string; border: string }> = {
  QB: {
    gradient: "from-red-500/15 via-red-600/5 to-transparent",
    glow: "shadow-red-500/20",
    text: "text-red-400",
    bg: "bg-red-500",
    border: "border-l-red-500",
  },
  RB: {
    gradient: "from-emerald-500/15 via-emerald-600/5 to-transparent",
    glow: "shadow-emerald-500/20",
    text: "text-emerald-400",
    bg: "bg-emerald-500",
    border: "border-l-emerald-500",
  },
  WR: {
    gradient: "from-blue-500/15 via-blue-600/5 to-transparent",
    glow: "shadow-blue-500/20",
    text: "text-blue-400",
    bg: "bg-blue-500",
    border: "border-l-blue-500",
  },
  TE: {
    gradient: "from-orange-500/15 via-orange-600/5 to-transparent",
    glow: "shadow-orange-500/20",
    text: "text-orange-400",
    bg: "bg-orange-500",
    border: "border-l-orange-500",
  },
  K: {
    gradient: "from-purple-500/15 via-purple-600/5 to-transparent",
    glow: "shadow-purple-500/20",
    text: "text-purple-400",
    bg: "bg-purple-500",
    border: "border-l-purple-500",
  },
  DEF: {
    gradient: "from-zinc-500/15 via-zinc-600/5 to-transparent",
    glow: "shadow-zinc-500/20",
    text: "text-zinc-400",
    bg: "bg-zinc-500",
    border: "border-l-zinc-500",
  },
};

export function KeeperCard({ keeper }: KeeperCardProps) {
  const config = positionConfig[keeper.player.position] || positionConfig.DEF;
  const isFranchise = keeper.type === "FRANCHISE";

  return (
    <div
      className={`
        group relative overflow-hidden rounded-xl
        bg-gradient-to-r ${config.gradient}
        bg-[#111822]
        border border-white/[0.08] border-l-[3px] ${config.border}
        hover:border-white/[0.14] hover:bg-[#141c2b]
        transition-all duration-200
        ${isFranchise ? "ring-1 ring-amber-500/25" : ""}
      `}
    >
      {/* Franchise tag indicator */}
      {isFranchise && (
        <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
          <div className="absolute top-2 -right-4 w-20 text-center transform rotate-45 bg-gradient-to-r from-amber-500 to-amber-600 text-[8px] font-bold text-black py-0.5 shadow-lg">
            FRANCHISE
          </div>
        </div>
      )}

      <div className="flex items-center gap-3.5 p-4">
        {/* Position badge — larger */}
        <div className={`
          w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0
          ${config.bg}/15 ring-1 ring-white/[0.08]
        `}>
          <span className={`text-base font-black ${config.text}`}>
            {keeper.player.position}
          </span>
        </div>

        {/* Player info — bigger name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white truncate">
              {keeper.player.fullName}
            </span>
            {isFranchise && (
              <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-zinc-400">{keeper.player.team}</span>
            {keeper.yearsKept && keeper.yearsKept > 1 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 font-medium">
                Year {keeper.yearsKept}
              </span>
            )}
          </div>
        </div>

        {/* Cost badge — neutral dark with white text for consistency */}
        <div className={`
          flex flex-col items-center justify-center px-3.5 py-2 rounded-lg
          ${isFranchise
            ? "bg-gradient-to-br from-amber-500/20 to-amber-600/10 ring-1 ring-amber-500/30"
            : "bg-[#0c1219] ring-1 ring-white/[0.10]"
          }
        `}>
          <span className={`text-xl font-black tabular-nums ${isFranchise ? "text-amber-400" : "text-white"}`}>
            R{keeper.finalCost}
          </span>
          <span className="text-[9px] text-zinc-500 uppercase font-semibold tracking-wider">Cost</span>
        </div>
      </div>

      {/* Hover glow */}
      <div className={`
        absolute inset-0 opacity-0 group-hover:opacity-100
        transition-opacity duration-500 pointer-events-none
        bg-gradient-to-r ${config.gradient}
      `} />
    </div>
  );
}

interface KeepersSectionProps {
  keepers: Keeper[];
  leagueId: string;
  rosterId: string;
  maxKeepers?: number;
}

export function KeepersSection({ keepers, leagueId, rosterId, maxKeepers = 7 }: KeepersSectionProps) {
  const franchiseCount = keepers.filter(k => k.type === "FRANCHISE").length;

  return (
    <div className="rounded-2xl overflow-hidden bg-[#0c1219] border border-white/[0.08] border-t-white/[0.12]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-[#080d14]/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Your Keepers</h3>
            <p className="text-xs text-zinc-500">
              {keepers.length}/{maxKeepers} selected
              {franchiseCount > 0 && ` • ${franchiseCount} franchise`}
            </p>
          </div>
        </div>
        <Link
          href={`/league/${leagueId}/team/${rosterId}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            text-amber-400 hover:text-amber-300
            bg-amber-500/10 hover:bg-amber-500/20
            transition-all duration-200"
        >
          Manage
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Keepers grid */}
      <div className="p-4">
        {keepers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {keepers.map((keeper) => (
              <KeeperCard key={keeper.id} keeper={keeper} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
              <TrendingUp className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-400">No keepers selected yet</p>
            <p className="text-xs text-zinc-600 mt-1">Select players to keep for next season</p>
          </div>
        )}
      </div>
    </div>
  );
}
