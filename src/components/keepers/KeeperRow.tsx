"use client";

import { memo } from "react";
import { ChevronRight, Star, Lock } from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { InjuryIndicator } from "@/components/ui/InjuryIndicator";
import { cn } from "@/lib/design-tokens";
import type { EligiblePlayer } from "./types";

interface KeeperRowProps {
  entry: EligiblePlayer;
  /** Live cascade SLOT for selected keepers (falls back to the stored slot) */
  liveSlot?: number;
  onClick: () => void;
}

/**
 * Compact one-line player row for the mobile keeper picker.
 *
 * Shows everything needed to compare candidates without opening the sheet:
 * name, position, team, keeper-year state, injury and the keeper price.
 * Full detail + actions live in PlayerDetailSheet (opened on tap).
 */
export const KeeperRow = memo(function KeeperRow({
  entry,
  liveSlot,
  onClick,
}: KeeperRowProps) {
  const { player, eligibility, costs, existingKeeper } = entry;
  const isKeeper = !!existingKeeper;
  const isFranchise = existingKeeper?.type === "FRANCHISE";
  const ftOnly = !isKeeper && eligibility.isEligible && !costs.regular && !!costs.franchise;

  // The number the user compares on is the PRICE — what the rules charge for
  // him. The slot (the pick actually spent) can differ once the cascade runs,
  // so it is shown as a separate marker rather than quietly replacing the
  // price in the same chip.
  const price = costs.regular?.price ?? costs.franchise?.price ?? null;
  const slot = isKeeper ? liveSlot ?? existingKeeper.finalCost : null;
  const slotDiffers = slot != null && price != null && slot !== price;

  // Keeper-year state: "Y1" for current keepers, "→Y2" for candidates
  const yearLabel = isKeeper
    ? isFranchise
      ? "FT"
      : `Y${eligibility.yearsKept || 1}`
    : ftOnly
      ? "FT only"
      : `→Y${(eligibility.yearsKept ?? 0) + 1}`;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 min-h-[56px] rounded-lg border text-left transition-colors",
        "active:bg-[#1c2840]",
        isKeeper
          ? isFranchise
            ? "bg-amber-500/[0.06] border-amber-500/30"
            : "bg-blue-500/[0.06] border-blue-500/30"
          : "bg-[#0c1219] border-white/[0.08] hover:border-white/[0.15]"
      )}
    >
      <PositionBadge position={player.position} size="xs" variant="filled" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white truncate">
            {player.fullName}
          </span>
          {isFranchise && (
            <Star size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" />
          )}
          {existingKeeper?.isLocked && (
            <Lock size={11} className="text-slate-500 flex-shrink-0" />
          )}
          {player.injuryStatus && player.injuryStatus !== "Active" && (
            <InjuryIndicator status={player.injuryStatus} />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>{player.team || "FA"}</span>
          <span aria-hidden="true">·</span>
          <span className={cn(ftOnly && "text-amber-400")}>{yearLabel}</span>
          {player.lastSeasonPpg != null && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{player.lastSeasonPpg.toFixed(1)} ppg</span>
            </>
          )}
        </div>
      </div>

      {/* Price chip — the comparison number, always visible */}
      {price != null && (
        <span
          className={cn(
            "flex-shrink-0 inline-flex items-center justify-center min-w-[44px] px-2 py-1 rounded-md text-sm font-bold tabular-nums",
            isKeeper
              ? isFranchise
                ? "bg-amber-500/20 text-amber-300"
                : "bg-blue-500/20 text-blue-300"
              : "bg-white/[0.06] text-slate-200"
          )}
        >
          {slotDiffers && (
            <span
              className="text-[10px] font-medium text-amber-400 mr-1"
              title={`Costs a round ${price}; takes your round ${slot} pick`}
            >
              ⤴{slot}
            </span>
          )}
          R{price}
        </span>
      )}

      <ChevronRight size={16} className="flex-shrink-0 text-slate-600" />
    </button>
  );
});
