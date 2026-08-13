"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/design-tokens";
import type { RosterData, CascadeKeeperResult } from "./types";

interface PlanningTrayProps {
  data: RosterData;
  /** Live cascade results for THIS roster (from the cascade endpoint) */
  cascadeResults: CascadeKeeperResult[] | undefined;
  className?: string;
}

/**
 * Sticky planning state — always visible while picking keepers.
 *
 * Answers, without scrolling: how many slots are used (total / FT / regular),
 * which draft rounds the current selection occupies, and whether the cascade
 * had to move anyone off their base round.
 */
export function PlanningTray({ data, cascadeResults, className }: PlanningTrayProps) {
  const { currentKeepers, limits } = data;

  const occupiedRounds = (cascadeResults ?? [])
    .map((r) => r.finalCost)
    .sort((a, b) => a - b);

  const cascadedCount = (cascadeResults ?? []).filter((r) => r.cascaded).length;
  const atCapacity = currentKeepers.total >= limits.maxKeepers;

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Slot usage */}
      <div className="flex items-center gap-2 flex-wrap">
        <SlotPill
          label="Keepers"
          used={currentKeepers.total}
          max={limits.maxKeepers}
          tone={atCapacity ? "full" : "default"}
        />
        <SlotPill
          label="FT"
          used={currentKeepers.franchise}
          max={limits.maxFranchiseTags}
          tone={currentKeepers.franchise >= limits.maxFranchiseTags ? "full" : "amber"}
        />
        <SlotPill
          label="Reg"
          used={currentKeepers.regular}
          max={limits.maxRegularKeepers}
          tone={currentKeepers.regular >= limits.maxRegularKeepers ? "full" : "default"}
        />
        {cascadedCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-xs font-medium">
            <AlertTriangle size={11} />
            {cascadedCount} cascaded
          </span>
        )}
      </div>

      {/* Rounds occupied by the current plan */}
      {occupiedRounds.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap text-xs" data-testid="tray-rounds">
          <span className="text-slate-500 mr-0.5">Rounds:</span>
          {occupiedRounds.map((round, i) => (
            <span
              key={`${round}-${i}`}
              className="px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 font-semibold tabular-nums"
            >
              R{round}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SlotPill({
  label,
  used,
  max,
  tone,
}: {
  label: string;
  used: number;
  max: number;
  tone: "default" | "amber" | "full";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums",
        tone === "full"
          ? "bg-emerald-500/15 text-emerald-400"
          : tone === "amber"
            ? "bg-amber-500/10 text-amber-400/90"
            : "bg-blue-500/10 text-blue-400"
      )}
    >
      {label} {used}/{max}
    </span>
  );
}
