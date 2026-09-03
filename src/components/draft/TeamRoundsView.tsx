"use client";

import { useEffect, useState } from "react";
import { Star, ArrowLeftRight, Lock } from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { cn } from "@/lib/design-tokens";
import { managerHues, teamWash } from "@/lib/design/identity";
import { buildPickSlots, heldPickCount } from "@/lib/keeper/pick-slots";

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

  // One hue per manager, assigned across the whole league — the same system
  // the keeper screens use, so a team is the same colour wherever you meet it.
  // Keyed on rosterId: stable and collision-free within a league, and it saves
  // plumbing the owner's Sleeper id down to a board that never needed it.
  const hues = managerHues(cascade.map((t) => t.rosterId));

  // Every pick this team holds, flattened — plus a line for each one dealt
  // away, which is a different fact from holding nothing in that round.
  const pickSlots = buildPickSlots({
    draftRounds,
    keepers: team.results,
    tradedAwayPicks: team.tradedAwayPicks,
    acquiredPicks: team.acquiredPicks,
    teamName: (rosterId) => rosterIdToName.get(rosterId) ?? null,
    tradedTo: (round) =>
      draftBoard
        .find((r) => r.round === round)
        ?.slots.find((s) => s.rosterId === team.rosterId)?.tradedTo ?? null,
  });
  const picksHeld = heldPickCount(pickSlots);

  return (
    <div className="space-y-3">
      {/* Team switcher */}
      <div className="scroll-x scrollbar-thin -mx-4 px-4">
        <div className="flex gap-1.5 pb-1 min-w-max">
          {cascade.map((t) => {
            const isSelected = t.rosterId === selectedRosterId;
            const isUser = t.rosterId === userRosterId;
            return (
              <button
                key={t.rosterId}
                onClick={() => setSelectedRosterId(t.rosterId)}
                className={cn(
                  "min-h-[40px] whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                  isSelected ? "text-white" : "text-slate-400 hover:text-white"
                )}
                // Every team wore the same blue when selected and the same
                // slate when not, so the switcher said only "which one is on",
                // never "which team". Their own colour says both.
                style={
                  isSelected
                    ? {
                        background: `${hues.get(t.rosterId)}2b`,
                        boxShadow: `inset 0 0 0 1px ${hues.get(t.rosterId)}`,
                      }
                    : { background: "rgba(255,255,255,0.035)" }
                }
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: hues.get(t.rosterId) }}
                  />
                  {t.rosterName || "Team"}
                  {isUser && <span className="text-[10px] opacity-60">you</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Picks, vertically */}
      {/* No outer card. Sixteen rounds inside a bordered panel read as a
          table embedded in the page; on their own they read as the board. */}
      {/* One row per pick, not per round. Two sevenths are two sevens — the
          round number repeats because the picks do. */}
      <div className="divide-y divide-white/[0.05]">
        {pickSlots.map((pick) => (
          <div
            key={pick.key}
            className="flex items-stretch gap-3 px-3 py-2 min-h-[48px]"
          >
            {/* Round number */}
            <div className="flex w-8 items-center justify-end">
              <span
                className={cn(
                  "font-numeral text-[22px] leading-none",
                  pick.kind === "traded" ? "text-slate-700" : "text-slate-600"
                )}
              >
                {pick.round}
              </span>
            </div>

            {/* The pick */}
            <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
              {pick.kind === "keeper" ? (
                <button
                  onClick={() => onPlayerClick?.(pick.keeper.playerId)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left",
                    pick.keeper.keeperType === "FRANCHISE"
                      ? "border border-amber-500/30"
                      : "border border-white/[0.06]"
                  )}
                  style={{ background: teamWash(pick.keeper.team, 0.38) }}
                >
                  <PositionBadge position={pick.keeper.position} size="xs" />
                  <span className="text-sm font-semibold text-white truncate">
                    {pick.keeper.playerName}
                  </span>
                  {pick.keeper.keeperType === "FRANCHISE" && (
                    <Star size={11} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                  )}
                  {pick.keeper.isLocked && (
                    <Lock size={10} className="text-slate-500 flex-shrink-0" />
                  )}
                  <span className="ml-auto flex items-center gap-1 flex-shrink-0 text-xs">
                    {pick.keeper.cascaded && (
                      <span className="text-slate-600 line-through">
                        R{pick.keeper.baseCost}
                      </span>
                    )}
                    {pick.keeper.yearsKept ? (
                      <span className="text-slate-500">Y{pick.keeper.yearsKept}</span>
                    ) : null}
                    {pick.from && (
                      <span className="text-emerald-400/80">via {pick.from}</span>
                    )}
                  </span>
                </button>
              ) : pick.kind === "open" ? (
                <span className="flex items-center gap-1.5 text-xs text-slate-600">
                  Open pick
                  {pick.from && (
                    <span className="text-emerald-400/80">via {pick.from}</span>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-rose-400/80">
                  <ArrowLeftRight size={11} />
                  Traded away{pick.to ? ` to ${pick.to}` : ""}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Team totals */}
      <p className="text-xs text-slate-500 text-center">
        {picksHeld} pick{picksHeld !== 1 ? "s" : ""} ·{" "}
        {team.results.length} keeper{team.results.length !== 1 ? "s" : ""} ·{" "}
        {team.acquiredPicks.length} acquired ·{" "}
        {team.tradedAwayPicks.length} traded away
      </p>
    </div>
  );
}
