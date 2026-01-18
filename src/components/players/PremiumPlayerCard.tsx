"use client";

import { memo } from "react";
import { PlayerAvatar, TeamLogo } from "./PlayerAvatar";
import { PositionBadge, RookieBadge } from "@/components/ui/PositionBadge";
import { InjuryIndicator } from "@/components/ui/InjuryIndicator";

interface Player {
  id: string;
  sleeperId: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
  team?: string | null;
  age?: number | null;
  yearsExp?: number | null;
  status?: string | null;
  injuryStatus?: string | null;
  // Fantasy stats
  fantasyPointsPpr?: number | null;
  fantasyPointsHalfPpr?: number | null;
  gamesPlayed?: number | null;
  pointsPerGame?: number | null;
  // Season-specific PPG
  lastSeasonPpg?: number | null;
  lastSeasonGames?: number | null;
  prevSeasonPpg?: number | null;
  prevSeasonGames?: number | null;
  lastSeason?: number;
  prevSeason?: number;
  isProjected?: boolean; // true if lastSeasonPpg is from projections (rookie/no historical data)
}

interface Eligibility {
  isEligible: boolean;
  reason: string | null;
  yearsKept: number;
  consecutiveYears?: number;
  acquisitionType: string;
  originalDraft?: {
    draftYear: number;
    draftRound: number;
  } | null;
}

interface Costs {
  franchise: { baseCost: number; finalCost: number; costBreakdown: string } | null;
  regular: { baseCost: number; finalCost: number; costBreakdown: string } | null;
}

interface ExistingKeeper {
  id: string;
  type: "FRANCHISE" | "REGULAR" | string;
  finalCost: number;
  isLocked: boolean;
}

interface PremiumPlayerCardProps {
  player: Player;
  eligibility?: Eligibility;
  costs?: Costs;
  existingKeeper?: ExistingKeeper | null;
  onAddKeeper?: (playerId: string, type: "FRANCHISE" | "REGULAR") => void;
  onRemoveKeeper?: (keeperId: string) => void;
  onShowHistory?: (playerId: string) => void;
  isLoading?: boolean;
  canAddFranchise?: boolean;
  canAddRegular?: boolean;
  className?: string;
}

const positionColors: Record<string, { bg: string; border: string }> = {
  QB: { bg: "bg-red-500/10", border: "border-red-500" },
  RB: { bg: "bg-green-500/10", border: "border-green-500" },
  WR: { bg: "bg-blue-500/10", border: "border-blue-500" },
  TE: { bg: "bg-orange-500/10", border: "border-orange-500" },
  K: { bg: "bg-purple-500/10", border: "border-purple-500" },
  DEF: { bg: "bg-zinc-500/10", border: "border-zinc-500" },
};

function getAcquisitionLabel(type: string): string {
  switch (type) {
    case "DRAFTED": return "Drafted";
    case "WAIVER": return "Waiver";
    case "FREE_AGENT": return "Free Agent";
    case "TRADE": return "Trade";
    default: return type;
  }
}

export const PremiumPlayerCard = memo(function PremiumPlayerCard({
  player,
  eligibility,
  costs,
  existingKeeper,
  onAddKeeper,
  onRemoveKeeper,
  onShowHistory,
  isLoading = false,
  canAddFranchise = true,
  canAddRegular = true,
  className = "",
}: PremiumPlayerCardProps) {
  const colors = positionColors[player.position || ""] || positionColors.DEF;
  const isKeeper = !!existingKeeper;
  const isEligible = eligibility?.isEligible ?? false;
  const isRookie = player.yearsExp === 0;

  return (
    <div
      className={`
        premium-player-card border-t-4 ${colors.border} ${colors.bg}
        flex flex-col p-3 sm:p-4
        ${!isEligible && !isKeeper ? "opacity-60" : ""}
        ${className}
      `}
    >
      {/* Header: Avatar + Name + Badges */}
      <div className="flex items-start gap-2 sm:gap-3">
        <button
          onClick={() => onShowHistory?.(player.id)}
          className="relative group flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="View keeper history"
        >
          <PlayerAvatar
            sleeperId={player.sleeperId}
            name={player.fullName}
            size="lg"
          />
          {onShowHistory && (
            <div className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            <span className="text-sm sm:text-base font-bold text-white truncate max-w-[140px] sm:max-w-none">{player.fullName}</span>
            {isRookie && <RookieBadge size="xs" />}
            {player.injuryStatus && <InjuryIndicator status={player.injuryStatus} />}
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1">
            <PositionBadge position={player.position} size="xs" variant="filled" />
            <TeamLogo team={player.team || null} size="xs" />
            <span className="text-[10px] sm:text-xs text-zinc-400">{player.team || "FA"}</span>
          </div>
        </div>
        {/* Keeper Badge */}
        {isKeeper && (
          <span
            className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${
              existingKeeper.type === "FRANCHISE"
                ? "bg-gradient-to-r from-amber-400 to-amber-600 text-black"
                : "bg-gradient-to-r from-amber-500 to-orange-600 text-white"
            }`}
          >
            {existingKeeper.type === "FRANCHISE" ? "FT" : "Keeper"}
          </span>
        )}
      </div>

      {/* Player Info Grid - Responsive: 2x2 on mobile, 4 cols on larger */}
      <div className="grid grid-cols-4 gap-1 sm:gap-2 mt-2 sm:mt-3 text-center">
        <div className="p-1.5 sm:p-0 rounded bg-white/[0.02] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-zinc-500 uppercase">Age</div>
          <div className="text-[11px] sm:text-xs font-semibold text-white">{player.age || "—"}</div>
        </div>
        <div className="p-1.5 sm:p-0 rounded bg-white/[0.02] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-zinc-500 uppercase">Exp</div>
          <div className="text-[11px] sm:text-xs font-semibold text-white">{player.yearsExp ?? 0}yr</div>
        </div>
        <div className="p-1.5 sm:p-0 rounded bg-white/[0.02] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-zinc-500 uppercase">
            {player.isProjected ? "Proj" : player.lastSeason ? `'${String(player.lastSeason).slice(-2)}` : ""}PPG
          </div>
          <div className={`text-[11px] sm:text-xs font-semibold ${player.isProjected ? "text-violet-400" : "text-emerald-400"}`}>
            {player.lastSeasonPpg ? player.lastSeasonPpg.toFixed(1) : "—"}
          </div>
        </div>
        <div className="p-1.5 sm:p-0 rounded bg-white/[0.02] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-zinc-500 uppercase">{player.prevSeason ? `'${String(player.prevSeason).slice(-2)}` : ""}PPG</div>
          <div className="text-[11px] sm:text-xs font-semibold text-sky-400">
            {player.prevSeasonPpg ? player.prevSeasonPpg.toFixed(1) : "—"}
          </div>
        </div>
      </div>

      {/* Keeper Year + Status Row */}
      <div className="grid grid-cols-3 gap-1 sm:gap-2 mt-1.5 sm:mt-2 text-center">
        <div className="p-1.5 sm:p-0 rounded bg-white/[0.02] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-zinc-500 uppercase">
            {player.isProjected ? "Est GP" : player.lastSeason ? `'${String(player.lastSeason).slice(-2)}GP` : "GP"}
          </div>
          <div className="text-[11px] sm:text-xs font-semibold text-white">
            {player.isProjected ? "17" : player.lastSeasonGames || "—"}
          </div>
        </div>
        <div className="p-1.5 sm:p-0 rounded bg-white/[0.02] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-zinc-500 uppercase">Status</div>
          <div className={`text-[11px] sm:text-xs font-semibold ${player.injuryStatus ? "text-red-400" : "text-green-400"}`}>
            {player.injuryStatus || "Active"}
          </div>
        </div>
        <div className="p-1.5 sm:p-0 rounded bg-white/[0.02] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-zinc-500 uppercase">Year</div>
          <div className={`text-[11px] sm:text-xs font-semibold ${
            isKeeper ? "text-amber-400" :
            (eligibility?.yearsKept ?? 1) >= 3 ? "text-amber-400" :
            (eligibility?.yearsKept ?? 1) === 2 ? "text-yellow-400" :
            "text-zinc-300"
          }`}>
            {isKeeper
              ? existingKeeper?.type === "FRANCHISE" ? "FT" : `Yr ${eligibility?.yearsKept ?? 1}`
              : eligibility?.yearsKept
                ? eligibility.yearsKept >= 3 ? "FT Req" : `Yr ${eligibility.yearsKept}`
                : "Yr 1"
            }
          </div>
        </div>
      </div>

      {/* Keeper Status Section */}
      {eligibility && (
        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/[0.06]">
          <div className="grid grid-cols-3 gap-1 text-center">
            <div>
              <div className="text-[8px] sm:text-[9px] text-zinc-500 uppercase">Drafted</div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-white">
                {eligibility.originalDraft
                  ? `'${String(eligibility.originalDraft.draftYear).slice(-2)} R${eligibility.originalDraft.draftRound}`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-[8px] sm:text-[9px] text-zinc-500 uppercase">Acquired</div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-white">{getAcquisitionLabel(eligibility.acquisitionType)}</div>
            </div>
            <div>
              <div className="text-[8px] sm:text-[9px] text-zinc-500 uppercase">Cost</div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-amber-400">
                {isKeeper ? `R${existingKeeper.finalCost}` : costs?.regular ? `R${costs.regular.finalCost}` : "R1 (FT)"}
              </div>
            </div>
          </div>

          {/* Cost Breakdown - shows escalation */}
          {costs?.regular && !isKeeper && (eligibility.consecutiveYears ?? 0) > 0 && (
            <div className="mt-1.5 sm:mt-2 text-[8px] sm:text-[9px] text-zinc-500 text-center">
              {costs.regular.costBreakdown}
            </div>
          )}

          {/* Year 3+ Warning */}
          {!isKeeper && (eligibility.yearsKept ?? 1) >= 3 && (
            <div className="mt-1.5 sm:mt-2 text-[8px] sm:text-[9px] text-amber-400 text-center">
              Franchise Tag required (Year {eligibility.yearsKept})
            </div>
          )}
        </div>
      )}

      {/* Action Buttons - Mobile optimized with min touch targets */}
      {!isKeeper && isEligible && costs && onAddKeeper && (
        <div className="flex items-center gap-2 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/[0.06]">
          {costs.regular && (
            <button
              onClick={() => onAddKeeper(player.id, "REGULAR")}
              disabled={!canAddRegular || isLoading}
              className="flex-1 min-h-[44px] sm:min-h-0 py-2.5 sm:py-1.5 rounded-lg sm:rounded text-xs sm:text-[10px] font-bold bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white disabled:opacity-40 transition-colors"
            >
              {isLoading ? "..." : `Keep R${costs.regular.finalCost}`}
            </button>
          )}
          {costs.franchise && (
            <button
              onClick={() => onAddKeeper(player.id, "FRANCHISE")}
              disabled={!canAddFranchise || isLoading}
              className="min-h-[44px] sm:min-h-0 min-w-[44px] px-4 sm:px-3 py-2.5 sm:py-1.5 rounded-lg sm:rounded text-xs sm:text-[10px] font-bold bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black disabled:opacity-40 transition-colors"
            >
              {isLoading ? "..." : "FT"}
            </button>
          )}
        </div>
      )}

      {/* Remove Keeper Button */}
      {isKeeper && !existingKeeper.isLocked && onRemoveKeeper && (
        <div className="flex items-center justify-center mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/[0.06]">
          <button
            onClick={() => onRemoveKeeper(existingKeeper.id)}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-0 px-6 sm:px-4 py-2.5 sm:py-1.5 rounded-lg sm:rounded text-xs sm:text-[10px] font-medium bg-red-500/20 hover:bg-red-500/30 active:bg-red-500/40 text-red-400 transition-colors"
          >
            {isLoading ? "Removing..." : "Remove Keeper"}
          </button>
        </div>
      )}
    </div>
  );
});
