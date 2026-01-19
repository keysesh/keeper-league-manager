"use client";

import { cn } from "@/lib/design-tokens";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { LayoutGrid } from "lucide-react";

interface Keeper {
  id: string;
  player: {
    fullName: string;
    position: string | null;
    team: string | null;
  };
  finalCost: number;
  type: string;
}

interface DraftPickSlotsProps {
  keepers: Keeper[];
  totalRounds?: number;
  season?: number;
}

export function DraftPickSlots({ keepers, totalRounds = 8, season }: DraftPickSlotsProps) {
  // Create a map of round -> keeper
  const keepersByRound = new Map<number, Keeper[]>();
  keepers.forEach((keeper) => {
    const round = keeper.finalCost;
    if (!keepersByRound.has(round)) {
      keepersByRound.set(round, []);
    }
    keepersByRound.get(round)!.push(keeper);
  });

  // Generate round slots
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
              <LayoutGrid className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-white">Your Draft Picks</h2>
          </div>
          {season && (
            <span className="text-xs text-slate-500 font-medium">{season} Draft</span>
          )}
        </div>
      </div>
      <div className="p-3 sm:p-5">
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
          {rounds.map((round) => {
            const keepersInRound = keepersByRound.get(round) || [];
            const hasKeeper = keepersInRound.length > 0;

            if (!hasKeeper) {
              // Empty slot
              return (
                <div
                  key={round}
                  className={cn(
                    "aspect-[3/4] rounded-lg border-2 border-dashed",
                    "border-white/[0.1] bg-white/[0.02]",
                    "flex flex-col items-center justify-center",
                    "text-slate-600 min-h-[90px]"
                  )}
                >
                  <span className="text-lg font-bold">R{round}</span>
                  <span className="text-[10px]">Available</span>
                </div>
              );
            }

            // Filled slot with keeper(s)
            return (
              <div key={round} className="relative">
                {keepersInRound.map((keeper, idx) => (
                  <div
                    key={keeper.id}
                    className={cn(
                      "aspect-[3/4] rounded-lg border min-h-[90px]",
                      keeper.type === "FRANCHISE"
                        ? "border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-orange-500/5"
                        : "border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-purple-500/5",
                      "p-2 flex flex-col",
                      idx > 0 && "absolute inset-0 translate-x-1 translate-y-1"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "text-[10px] font-bold",
                          keeper.type === "FRANCHISE" ? "text-amber-400" : "text-blue-400"
                        )}
                      >
                        R{round}
                      </span>
                      {keeper.type === "FRANCHISE" && (
                        <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                          FT
                        </span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center">
                      <PositionBadge position={keeper.player.position} size="xs" />
                      <span className="text-[10px] sm:text-xs font-semibold text-white mt-1 text-center truncate w-full px-0.5">
                        {keeper.player.fullName.split(" ").pop()}
                      </span>
                      {keeper.player.team && (
                        <span className="text-[8px] text-slate-500">{keeper.player.team}</span>
                      )}
                    </div>
                  </div>
                ))}
                {/* Multi-pick indicator */}
                {keepersInRound.length > 1 && (
                  <div className="absolute -right-1 -bottom-1">
                    <span className="text-[8px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                      +{keepersInRound.length - 1}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 mt-4 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-blue-500/30 to-purple-500/20 border border-blue-500/30" />
            <span className="text-[10px] text-slate-500">Keeper</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-500/30" />
            <span className="text-[10px] text-slate-500">Franchise Tag</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-2 border-dashed border-white/[0.15]" />
            <span className="text-[10px] text-slate-500">Available</span>
          </div>
        </div>
      </div>
    </div>
  );
}
