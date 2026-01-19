"use client";

import { memo } from "react";
import { PlayerAvatar, TeamLogo } from "./PlayerAvatar";
import { PositionBadge, RookieBadge } from "@/components/ui/PositionBadge";
import { InjuryIndicator } from "@/components/ui/InjuryIndicator";
import { getAgeInfo } from "@/components/ui/AgeBadge";
import { calculateCostTrajectory, CostTrajectory } from "@/components/ui/CostTrajectory";

interface NFLVerseMetadata {
  ranking?: {
    ecr?: number;
    positionRank?: number;
    rankingDate?: string;
  };
  depthChart?: {
    depthPosition?: number;
    formation?: string;
  };
  injury?: {
    status?: string;
    primaryInjury?: string;
    secondaryInjury?: string;
    practiceStatus?: string;
  };
}

interface PlayerMetadata {
  nflverse?: NFLVerseMetadata;
}

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
  fantasyPointsPpr?: number | null;
  fantasyPointsHalfPpr?: number | null;
  gamesPlayed?: number | null;
  pointsPerGame?: number | null;
  lastSeasonPpg?: number | null;
  lastSeasonGames?: number | null;
  prevSeasonPpg?: number | null;
  prevSeasonGames?: number | null;
  lastSeason?: number;
  prevSeason?: number;
  isProjected?: boolean;
  metadata?: PlayerMetadata | null;
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

// Position accent colors - muted, just for top border
const positionAccents: Record<string, string> = {
  QB: "border-t-rose-500",
  RB: "border-t-emerald-500",
  WR: "border-t-sky-500",
  TE: "border-t-amber-500",
  K: "border-t-violet-500",
  DEF: "border-t-slate-500",
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
  const positionAccent = positionAccents[player.position || ""] || positionAccents.DEF;
  const isKeeper = !!existingKeeper;
  const isEligible = eligibility?.isEligible ?? false;
  const isRookie = player.yearsExp === 0;

  // Extract NFLverse metadata
  const nflverse = player.metadata?.nflverse;
  const positionRank = nflverse?.ranking?.positionRank;
  const depthPosition = nflverse?.depthChart?.depthPosition;
  const isStarter = depthPosition === 1;
  const nflverseInjury = nflverse?.injury;

  return (
    <div
      className={`
        bg-[#1a1a1a] border border-[#2a2a2a] rounded-md border-t-2 ${positionAccent}
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
            <div className="absolute inset-0 bg-black/50 rounded-md opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity flex items-center justify-center">
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
            {isStarter && (
              <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-500/20 text-blue-400" title="Starter">
                ST
              </span>
            )}
            {(nflverseInjury?.status || player.injuryStatus) && (
              <InjuryIndicator status={nflverseInjury?.status || player.injuryStatus} />
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1">
            <PositionBadge position={player.position} size="xs" variant="filled" />
            {positionRank && (
              <span className="text-[9px] font-bold text-gray-300">
                #{positionRank}
              </span>
            )}
            <TeamLogo team={player.team || null} size="xs" />
            <span className="text-[10px] sm:text-xs text-gray-400">{player.team || "FA"}</span>
          </div>
        </div>
        {/* Keeper Badge */}
        {isKeeper && (
          <span
            className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded-md flex-shrink-0 ${
              existingKeeper.type === "FRANCHISE"
                ? "bg-blue-500 text-white"
                : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
            }`}
          >
            {existingKeeper.type === "FRANCHISE" ? "FT" : "Keeper"}
          </span>
        )}
      </div>

      {/* Player Info Grid */}
      <div className="grid grid-cols-5 gap-1 sm:gap-2 mt-2 sm:mt-3 text-center">
        <div className="p-1.5 sm:p-0 rounded bg-[#222222] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase">ECR</div>
          <div className={`text-[11px] sm:text-xs font-semibold ${nflverse?.ranking?.ecr ? "text-purple-400" : "text-gray-500"}`}>
            {nflverse?.ranking?.ecr ? `#${Math.round(nflverse.ranking.ecr)}` : "—"}
          </div>
        </div>
        <div className="p-1.5 sm:p-0 rounded bg-[#222222] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase">Age</div>
          {(() => {
            const ageInfo = getAgeInfo(player.age ?? null, player.position ?? null);
            return (
              <div
                className={`text-[11px] sm:text-xs font-semibold ${ageInfo?.text || "text-white"}`}
                title={ageInfo ? `${ageInfo.label} - Age ${player.age} for ${player.position || "player"}` : undefined}
              >
                {player.age || "—"}
              </div>
            );
          })()}
        </div>
        <div className="p-1.5 sm:p-0 rounded bg-[#222222] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase">Exp</div>
          <div className={`text-[11px] sm:text-xs font-semibold ${player.yearsExp === 0 ? "text-purple-400" : "text-white"}`}>
            {player.yearsExp === 0 ? "Rookie" : `${player.yearsExp ?? 0}yr`}
          </div>
        </div>
        <div className="p-1.5 sm:p-0 rounded bg-[#222222] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase">
            {player.isProjected ? "Proj" : player.lastSeason ? `'${String(player.lastSeason).slice(-2)}` : ""}PPG
          </div>
          <div className={`text-[11px] sm:text-xs font-semibold ${player.isProjected ? "text-blue-400" : "text-white"}`}>
            {player.lastSeasonPpg ? player.lastSeasonPpg.toFixed(1) : "—"}
          </div>
        </div>
        <div className="p-1.5 sm:p-0 rounded bg-[#222222] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase">{player.prevSeason ? `'${String(player.prevSeason).slice(-2)}` : ""}PPG</div>
          <div className="text-[11px] sm:text-xs font-semibold text-gray-300">
            {player.prevSeasonPpg ? player.prevSeasonPpg.toFixed(1) : "—"}
          </div>
        </div>
      </div>

      {/* Keeper Year + Status Row */}
      <div className="grid grid-cols-3 gap-1 sm:gap-2 mt-1.5 sm:mt-2 text-center">
        <div className="p-1.5 sm:p-0 rounded bg-[#222222] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase">
            {player.isProjected ? "Est GP" : player.lastSeason ? `'${String(player.lastSeason).slice(-2)}GP` : "GP"}
          </div>
          <div className="text-[11px] sm:text-xs font-semibold text-white">
            {player.isProjected ? "17" : player.lastSeasonGames || "—"}
          </div>
        </div>
        <div className="p-1.5 sm:p-0 rounded bg-[#222222] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase">Status</div>
          <div
            className={`text-[11px] sm:text-xs font-semibold ${(nflverseInjury?.status || player.injuryStatus) ? "text-red-400" : "text-gray-300"}`}
            title={nflverseInjury?.primaryInjury || undefined}
          >
            {nflverseInjury?.status || player.injuryStatus || "Active"}
            {nflverseInjury?.primaryInjury && (
              <span className="text-[8px] text-gray-500 block truncate">
                {nflverseInjury.primaryInjury}
              </span>
            )}
          </div>
        </div>
        <div className="p-1.5 sm:p-0 rounded bg-[#222222] sm:bg-transparent">
          <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase">
            {isKeeper ? "Year" : "If Kept"}
          </div>
          <div className={`text-[11px] sm:text-xs font-semibold ${
            isKeeper ? "text-blue-400" :
            (eligibility?.yearsKept ?? 0) >= 2 ? "text-amber-400" :
            "text-emerald-400"
          }`}>
            {isKeeper
              ? existingKeeper?.type === "FRANCHISE" ? "FT" : `Yr ${eligibility?.yearsKept ?? 1}`
              : eligibility?.yearsKept
                ? eligibility.yearsKept >= 2 ? "FT Only" : `→ Yr ${eligibility.yearsKept + 1}`
                : "→ Yr 1"
            }
          </div>
        </div>
      </div>

      {/* Keeper Status Section */}
      {eligibility && (
        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-[#2a2a2a]">
          <div className="grid grid-cols-3 gap-1 text-center">
            <div>
              <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase">Drafted</div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-white">
                {eligibility.originalDraft
                  ? `'${String(eligibility.originalDraft.draftYear).slice(-2)} R${eligibility.originalDraft.draftRound}`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase">Acquired</div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-white">{getAcquisitionLabel(eligibility.acquisitionType)}</div>
            </div>
            <div>
              <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase">Cost</div>
              <div className="text-[10px] sm:text-[11px] font-semibold text-blue-400">
                {isKeeper ? `R${existingKeeper.finalCost}` : costs?.regular ? `R${costs.regular.finalCost}` : "R1 (FT)"}
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          {costs?.regular && !isKeeper && (eligibility.consecutiveYears ?? 0) > 0 && (
            <div className="mt-1.5 sm:mt-2 text-[8px] sm:text-[9px] text-gray-500 text-center">
              {costs.regular.costBreakdown}
            </div>
          )}

          {/* Cost Trajectory - show future keeper costs */}
          {costs?.regular && eligibility.yearsKept < 2 && (
            <div className="mt-2 sm:mt-3">
              <div className="text-[8px] sm:text-[9px] text-gray-500 uppercase mb-1 text-center">
                Future Costs
              </div>
              <CostTrajectory
                trajectory={calculateCostTrajectory(costs.regular.finalCost, eligibility.yearsKept, 2)}
                currentCost={costs.regular.finalCost}
                yearsKept={eligibility.yearsKept}
                maxYears={2}
                compact={true}
              />
            </div>
          )}

          {/* Maxed out - Franchise Tag only */}
          {!isKeeper && (eligibility.yearsKept ?? 0) >= 2 && (
            <div className="mt-1.5 sm:mt-2 text-[8px] sm:text-[9px] text-amber-400 text-center">
              Maxed out ({eligibility.yearsKept} years) — Franchise Tag required
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {!isKeeper && isEligible && costs && onAddKeeper && (
        <div className="flex items-center gap-2 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-[#2a2a2a]">
          {costs.regular && (
            <button
              onClick={() => onAddKeeper(player.id, "REGULAR")}
              disabled={!canAddRegular || isLoading}
              className="flex-1 min-h-[44px] sm:min-h-0 py-2.5 sm:py-1.5 rounded-md sm:rounded text-xs sm:text-[10px] font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white disabled:opacity-40 transition-colors"
            >
              {isLoading ? "..." : `Keep R${costs.regular.finalCost}`}
            </button>
          )}
          {/* FT-only button (gold, full-width) - for players who MUST be franchise tagged */}
          {costs.franchise && !costs.regular && (
            <button
              onClick={() => onAddKeeper(player.id, "FRANCHISE")}
              disabled={!canAddFranchise || isLoading}
              className="flex-1 min-h-[44px] sm:min-h-0 py-2.5 sm:py-1.5 rounded-md sm:rounded text-xs sm:text-[10px] font-bold bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black disabled:opacity-40 transition-colors"
            >
              {isLoading ? "..." : `Franchise Tag (R${costs.franchise.finalCost})`}
            </button>
          )}
          {/* Compact FT button (blue) - when both regular keep and FT are available */}
          {costs.franchise && costs.regular && (
            <button
              onClick={() => onAddKeeper(player.id, "FRANCHISE")}
              disabled={!canAddFranchise || isLoading}
              className="min-h-[44px] sm:min-h-0 min-w-[44px] px-4 sm:px-3 py-2.5 sm:py-1.5 rounded-md sm:rounded text-xs sm:text-[10px] font-bold bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-white disabled:opacity-40 transition-colors"
            >
              {isLoading ? "..." : "FT"}
            </button>
          )}
        </div>
      )}

      {/* Remove Keeper Button */}
      {isKeeper && !existingKeeper.isLocked && onRemoveKeeper && (
        <div className="flex items-center justify-center mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-[#2a2a2a]">
          <button
            onClick={() => onRemoveKeeper(existingKeeper.id)}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-0 px-6 sm:px-4 py-2.5 sm:py-1.5 rounded-md sm:rounded text-xs sm:text-[10px] font-medium bg-red-500/20 hover:bg-red-500/30 active:bg-red-500/40 text-red-400 border border-red-500/30 transition-colors"
          >
            {isLoading ? "Removing..." : "Remove Keeper"}
          </button>
        </div>
      )}
    </div>
  );
});
