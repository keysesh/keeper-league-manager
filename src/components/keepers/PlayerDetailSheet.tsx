"use client";

import { Star, History } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { PlayerAvatar, TeamLogo } from "@/components/players/PlayerAvatar";
import { PositionBadge, RookieBadge } from "@/components/ui/PositionBadge";
import { getAgeInfo } from "@/components/ui/AgeBadge";
import {
  CostTrajectory,
  calculateCostTrajectory,
} from "@/components/ui/CostTrajectory";
import { cn } from "@/lib/design-tokens";
import type { EligiblePlayer } from "./types";

interface PlayerDetailSheetProps {
  entry: EligiblePlayer | null;
  isOpen: boolean;
  onClose: () => void;
  canAddFranchise: boolean;
  canAddRegular: boolean;
  onAddKeeper: (playerId: string, type: "FRANCHISE" | "REGULAR") => void;
  onRemoveKeeper: (keeperId: string) => void;
  onShowHistory: (playerId: string) => void;
}

function getAcquisitionLabel(type: string): string {
  switch (type) {
    case "DRAFTED": return "Drafted";
    case "WAIVER": return "Waiver";
    case "FREE_AGENT": return "Free Agent";
    case "TRADE": return "Trade";
    default: return type;
  }
}

/**
 * Player detail bottom sheet — opened from a KeeperRow tap.
 * Full stats, keeper facts, future costs and the Keep / FT / Remove actions.
 * Row tap → action tap = the 2-interaction add path.
 */
export function PlayerDetailSheet({
  entry,
  isOpen,
  onClose,
  canAddFranchise,
  canAddRegular,
  onAddKeeper,
  onRemoveKeeper,
  onShowHistory,
}: PlayerDetailSheetProps) {
  if (!entry) return null;

  const { player, eligibility, costs, existingKeeper } = entry;
  const isKeeper = !!existingKeeper;
  const isRookie = player.yearsExp === 0;
  const ageInfo = getAgeInfo(player.age ?? null, player.position ?? null);

  // What keeping him costs. Not the round he was drafted in, and not the slot
  // the cascade puts him in — this sheet is where those three get told apart.
  const cost = costs.regular ?? costs.franchise;
  const price = cost?.price ?? null;
  const slotDiffers =
    isKeeper && price != null && existingKeeper.finalCost !== price;

  const priceExplanation = (() => {
    if (!cost) return null;
    if (eligibility.priceBasis === "OVERRIDE") {
      return `Set by the commissioner at round ${cost.startingRound}.`;
    }
    if (eligibility.priceBasis === "UNDRAFTED") {
      return eligibility.originalDraft
        ? `He went round ${eligibility.originalDraft.draftRound} back in ${eligibility.originalDraft.draftYear}, but he came back through waivers in a later season — that resets him to the league's flat round ${cost.startingRound}.`
        : `Never drafted in this league, so he costs the flat round ${cost.startingRound} the first time he is kept.`;
    }
    return cost.costBreakdown;
  })();

  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      {/* Player header */}
      <div className="flex items-start gap-3 pb-4 border-b border-white/[0.08]">
        <PlayerAvatar sleeperId={player.sleeperId} name={player.fullName} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-lg font-bold text-white">{player.fullName}</span>
            {isRookie && <RookieBadge size="xs" />}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <PositionBadge position={player.position} size="xs" variant="filled" />
            <TeamLogo team={player.team || null} size="xs" />
            <span className="text-sm text-slate-400">{player.team || "FA"}</span>
            {player.age && (
              <span className={cn("text-sm", ageInfo?.text || "text-slate-400")}>
                Age {player.age}
              </span>
            )}
          </div>
          {player.injuryStatus && player.injuryStatus !== "Active" && (
            <p className="text-sm text-red-400 mt-1">{player.injuryStatus}</p>
          )}
        </div>
        {isKeeper && (
          <span
            className={cn(
              "text-xs font-bold px-2.5 py-1 rounded-md flex-shrink-0",
              existingKeeper.type === "FRANCHISE"
                ? "bg-amber-500/20 text-amber-300"
                : "bg-blue-500/20 text-blue-300"
            )}
          >
            {existingKeeper.type === "FRANCHISE" ? "Franchise" : "Keeper"} · slot R
            {existingKeeper.finalCost}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 py-4 text-center">
        <StatCell
          label={player.lastSeason ? `'${String(player.lastSeason).slice(-2)} PPG` : "PPG"}
          value={player.lastSeasonPpg != null ? player.lastSeasonPpg.toFixed(1) : "—"}
        />
        <StatCell
          label={player.lastSeason ? `'${String(player.lastSeason).slice(-2)} GP` : "GP"}
          value={player.lastSeasonGames != null ? String(player.lastSeasonGames) : "—"}
        />
        <StatCell
          label={player.prevSeason ? `'${String(player.prevSeason).slice(-2)} PPG` : "Prev PPG"}
          value={player.prevSeasonPpg != null ? player.prevSeasonPpg.toFixed(1) : "—"}
        />
        <StatCell
          label="Exp"
          value={player.yearsExp === 0 ? "Rookie" : `${player.yearsExp ?? 0} yr`}
        />
      </div>

      {/* Keeper facts */}
      <div className="rounded-lg bg-[#0c1219] border border-white/[0.08] p-3 space-y-2">
        <div className="grid grid-cols-3 gap-2 text-center">
          <StatCell
            label="Drafted"
            value={
              eligibility.originalDraft
                ? `'${String(eligibility.originalDraft.draftYear).slice(-2)} R${eligibility.originalDraft.draftRound}`
                : "Undrafted"
            }
          />
          <StatCell label="Acquired" value={getAcquisitionLabel(eligibility.acquisitionType)} />
          <StatCell
            label={isKeeper ? "Year" : "If kept"}
            value={
              isKeeper
                ? existingKeeper.type === "FRANCHISE"
                  ? "FT"
                  : `Yr ${eligibility.yearsKept ?? 1}`
                : !costs.regular
                  ? "FT only"
                  : `Yr ${(eligibility.yearsKept ?? 0) + 1}`
            }
          />
        </div>

        {/*
          Price, and the two ways it gets mistaken for something else.
          "Drafted" above is history — for an undrafted pickup, or a player
          claimed back in a later season, it is NOT what he costs. And the
          price is not the draft slot either: the cascade slides a keeper off
          his price when the roster already has one there.
        */}
        {price != null && (
          <div className="rounded-md bg-white/[0.03] border border-white/[0.06] px-3 py-2 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">
                Keeper price
              </span>
              <span className="text-base font-bold text-white tabular-nums">R{price}</span>
            </div>

            {priceExplanation && (
              <p className="text-xs text-slate-400 text-left">{priceExplanation}</p>
            )}

            {slotDiffers && (
              <>
                <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-white/[0.06]">
                  <span className="text-[11px] uppercase tracking-wide text-amber-400/80">
                    Draft slot
                  </span>
                  <span className="text-sm font-bold text-amber-300 tabular-nums">
                    R{existingKeeper!.finalCost}
                  </span>
                </div>
                <p className="text-xs text-amber-400/80 text-left">
                  You already have a keeper at round {price}, so this one takes
                  your round {existingKeeper!.finalCost} pick instead. The price
                  is unchanged.
                </p>
              </>
            )}
          </div>
        )}

        {/* Future costs */}
        {costs.regular && (
          <div>
            <p className="text-[11px] text-slate-500 uppercase tracking-wide text-center mb-1">
              Future costs
            </p>
            <CostTrajectory
              trajectory={calculateCostTrajectory(costs.regular.price, eligibility.yearsKept, 2)}
              currentCost={costs.regular.price}
              yearsKept={eligibility.yearsKept}
              maxYears={2}
              compact={true}
            />
          </div>
        )}

        {!isKeeper && !costs.regular && costs.franchise && (
          <p className="text-xs text-amber-400 text-center">
            Maxed out ({eligibility.yearsKept} years) — Franchise Tag required
          </p>
        )}

        {!eligibility.isEligible && !isKeeper && eligibility.reason && (
          <p className="text-xs text-rose-400 text-center">{eligibility.reason}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-4">
        {!isKeeper && eligibility.isEligible && (
          <div className="flex gap-2">
            {costs.regular && (
              <button
                onClick={() => {
                  onAddKeeper(player.id, "REGULAR");
                  onClose();
                }}
                disabled={!canAddRegular}
                className="flex-1 min-h-[48px] rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white disabled:opacity-40 transition-colors"
              >
                Keep · R{costs.regular.price}
              </button>
            )}
            {costs.franchise && (
              <button
                onClick={() => {
                  onAddKeeper(player.id, "FRANCHISE");
                  onClose();
                }}
                disabled={!canAddFranchise}
                className={cn(
                  "min-h-[48px] rounded-lg text-sm font-bold bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5",
                  costs.regular ? "px-5" : "flex-1"
                )}
              >
                <Star size={14} className="fill-current" />
                {costs.regular ? "FT" : `Franchise Tag · R${costs.franchise.price}`}
              </button>
            )}
          </div>
        )}

        {isKeeper && !existingKeeper.isLocked && (
          <button
            onClick={() => {
              onRemoveKeeper(existingKeeper.id);
              onClose();
            }}
            className="min-h-[48px] rounded-lg text-sm font-semibold bg-red-500/15 hover:bg-red-500/25 active:bg-red-500/30 text-red-400 border border-red-500/30 transition-colors"
          >
            Remove Keeper
          </button>
        )}

        {isKeeper && existingKeeper.isLocked && (
          <p className="text-center text-sm text-slate-500 py-2">
            Locked — keeper selections are finalized
          </p>
        )}

        <button
          onClick={() => {
            onClose();
            onShowHistory(player.id);
          }}
          className="min-h-[44px] rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-[#1c2840] transition-colors flex items-center justify-center gap-2"
        >
          <History size={15} />
          Keeper history
        </button>
      </div>
    </Sheet>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm font-semibold text-white tabular-nums">{value}</div>
    </div>
  );
}
