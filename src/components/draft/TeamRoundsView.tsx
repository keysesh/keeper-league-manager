"use client";

import { useEffect, useState } from "react";
import { Star, ArrowLeftRight, Lock } from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { cn } from "@/lib/design-tokens";

interface KeeperResult {
  playerId: string;
  playerName: string;
  position: string | null;
  team: string | null;
  baseCost: number;
  finalCost: number;
  cascaded: boolean;
  yearsKept?: number;
  keeperType?: "FRANCHISE" | "REGULAR";
  isLocked?: boolean;
}

interface TeamCascade {
  rosterId: string;
  rosterName: string | null;
  results: KeeperResult[];
  tradedAwayPicks: number[];
  acquiredPicks: Array<{ round: number; fromRosterId: string }>;
}

interface BoardSlot {
  rosterId: string;
  rosterName: string | null;
  status: "available" | "keeper" | "traded";
  tradedTo?: string;
}

interface TeamRoundsViewProps {
  cascade: TeamCascade[];
  draftBoard: Array<{ round: number; slots: BoardSlot[] }>;
  draftRounds: number;
  /** The viewer's roster — selected by default */
  userRosterId?: string;
  onPlayerClick?: (playerId: string) => void;
}

/**
 * Team-first draft board — the mobile model.
 *
 * One team at a time, rounds reading vertically (the way a manager actually
 * thinks about their board), with a one-tap team switcher. Replaces the old
 * mobile grid of 16 independent horizontal scrollers.
 */
export function TeamRoundsView({
  cascade,
  draftBoard,
  draftRounds,
  userRosterId,
  onPlayerClick,
}: TeamRoundsViewProps) {
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);

  // Default to the viewer's team once known
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!selectedRosterId && cascade.length > 0) {
      setSelectedRosterId(
        userRosterId && cascade.some((t) => t.rosterId === userRosterId)
          ? userRosterId
          : cascade[0].rosterId
      );
    }
  }, [selectedRosterId, userRosterId, cascade]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const team = cascade.find((t) => t.rosterId === selectedRosterId);
  if (!team) return null;

  const rosterIdToName = new Map(
    cascade.map((t) => [t.rosterId, t.rosterName || "Team"])
  );

  return (
    <div className="space-y-3">
      {/* Team switcher */}
      <div className="overflow-x-auto scrollbar-thin -mx-4 px-4">
        <div className="flex gap-1.5 pb-1 min-w-max">
          {cascade.map((t) => {
            const isSelected = t.rosterId === selectedRosterId;
            const isUser = t.rosterId === userRosterId;
            return (
              <button
                key={t.rosterId}
                onClick={() => setSelectedRosterId(t.rosterId)}
                className={cn(
                  "px-3 py-2 min-h-[40px] rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors",
                  isSelected
                    ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                    : "bg-[#141c2b] border-white/[0.08] text-slate-400 hover:text-white"
                )}
              >
                {isUser ? "★ " : ""}
                {t.rosterName || "Team"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rounds, vertically */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0c1219] overflow-hidden divide-y divide-white/[0.05]">
        {Array.from({ length: draftRounds }, (_, i) => {
          const round = i + 1;
          const keepersHere = team.results.filter((k) => k.finalCost === round);
          const tradedAway = team.tradedAwayPicks.includes(round);
          const acquired = team.acquiredPicks.filter((p) => p.round === round);
          const slot = draftBoard
            .find((r) => r.round === round)
            ?.slots.find((s) => s.rosterId === team.rosterId);

          return (
            <div key={round} className="flex items-stretch gap-3 px-3 py-2 min-h-[48px]">
              {/* Round number */}
              <div className="flex items-center">
                <span className="flex items-center justify-center w-8 h-8 rounded-md bg-[#141c2b] border border-white/[0.08] text-blue-400 font-bold text-xs tabular-nums">
                  {round}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 py-0.5">
                {keepersHere.map((k) => (
                  <button
                    key={k.playerId}
                    onClick={() => onPlayerClick?.(k.playerId)}
                    className={cn(
                      "flex items-center gap-2 text-left rounded-md px-2 py-1.5 border",
                      k.keeperType === "FRANCHISE"
                        ? "bg-amber-500/[0.07] border-amber-500/25"
                        : "bg-blue-500/[0.06] border-blue-500/25"
                    )}
                  >
                    <PositionBadge position={k.position} size="xs" />
                    <span className="text-sm font-semibold text-white truncate">
                      {k.playerName}
                    </span>
                    {k.keeperType === "FRANCHISE" && (
                      <Star size={11} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                    )}
                    {k.isLocked && <Lock size={10} className="text-slate-500 flex-shrink-0" />}
                    <span className="ml-auto flex items-center gap-1 flex-shrink-0 text-xs">
                      {k.cascaded && (
                        <span className="text-slate-600 line-through">R{k.baseCost}</span>
                      )}
                      {k.yearsKept ? (
                        <span className="text-slate-500">Y{k.yearsKept}</span>
                      ) : null}
                    </span>
                  </button>
                ))}

                {keepersHere.length === 0 && tradedAway && (
                  <span className="flex items-center gap-1.5 text-xs text-rose-400/80">
                    <ArrowLeftRight size={11} />
                    Traded away{slot?.tradedTo ? ` to ${slot.tradedTo}` : ""}
                  </span>
                )}

                {keepersHere.length === 0 && !tradedAway && (
                  <span className="text-xs text-slate-600">Open pick</span>
                )}

                {acquired.length > 0 && (
                  <span className="text-[11px] text-emerald-400/80">
                    +{acquired.length} extra pick{acquired.length > 1 ? "s" : ""} via trade
                    {acquired[0] && rosterIdToName.get(acquired[0].fromRosterId)
                      ? ` (from ${acquired.map((a) => rosterIdToName.get(a.fromRosterId)).join(", ")})`
                      : ""}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Team totals */}
      <p className="text-xs text-slate-500 text-center">
        {team.results.length} keeper{team.results.length !== 1 ? "s" : ""} ·{" "}
        {team.tradedAwayPicks.length} pick{team.tradedAwayPicks.length !== 1 ? "s" : ""} traded away ·{" "}
        {team.acquiredPicks.length} acquired
      </p>
    </div>
  );
}
