"use client";

import { useEffect, useState } from "react";
import { Star, ArrowLeftRight, Lock } from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { cn } from "@/lib/design-tokens";
import { managerHues, teamWash } from "@/lib/design/identity";

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

      {/* Rounds, vertically */}
      {/* No outer card. Sixteen rounds inside a bordered panel read as a
          table embedded in the page; on their own they read as the board. */}
      <div className="divide-y divide-white/[0.05]">
        {Array.from({ length: draftRounds }, (_, i) => {
          const round = i + 1;
          const keepersHere = team.results.filter((k) => k.finalCost === round);
          const acquired = team.acquiredPicks.filter((p) => p.round === round);
          // A round is not one pick. A team can have traded its own away and
          // still hold two acquired ones, and the board used to render that as
          // a single row plus a footnote reading "+2 extra picks via trade" —
          // so a manager holding three fifths saw one slot. Every pick owned
          // gets a slot of its own; keepers fill them in order, the rest are
          // open.
          const tradedAwayCount = team.tradedAwayPicks.filter((r) => r === round).length;
          const ownPicks = Math.max(0, 1 - tradedAwayCount);
          const pickSlots: Array<{ from: string | null }> = [
            ...Array.from({ length: ownPicks }, () => ({ from: null })),
            ...acquired.map((a) => ({ from: rosterIdToName.get(a.fromRosterId) ?? "another team" })),
          ];
          const tradedAway = tradedAwayCount > 0;
          const slot = draftBoard
            .find((r) => r.round === round)
            ?.slots.find((s) => s.rosterId === team.rosterId);

          return (
            <div key={round} className="flex items-stretch gap-3 px-3 py-2 min-h-[48px]">
              {/* Round number */}
              <div className="flex w-8 items-center justify-end">
                <span className="font-numeral text-[22px] leading-none text-slate-600">
                  {round}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 py-0.5">
                {pickSlots.map((pick, slotIndex) => {
                  const k = keepersHere[slotIndex];
                  if (!k) {
                    return (
                      <span
                        key={`open-${slotIndex}`}
                        className="flex items-center gap-1.5 text-xs text-slate-600"
                      >
                        Open pick
                        {pick.from && (
                          <span className="text-emerald-400/80">via {pick.from}</span>
                        )}
                      </span>
                    );
                  }
                  return (
                  <button
                    key={k.playerId}
                    onClick={() => onPlayerClick?.(k.playerId)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left",
                      k.keeperType === "FRANCHISE"
                        ? "border border-amber-500/30"
                        : "border border-white/[0.06]"
                    )}
                    style={{ background: teamWash(k.team, 0.38) }}
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
                      {pick.from && (
                        <span className="text-emerald-400/80">via {pick.from}</span>
                      )}
                    </span>
                  </button>
                  );
                })}

                {tradedAway && (
                  <span className="flex items-center gap-1.5 text-xs text-rose-400/80">
                    <ArrowLeftRight size={11} />
                    Traded away{slot?.tradedTo ? ` to ${slot.tradedTo}` : ""}
                  </span>
                )}

                {pickSlots.length === 0 && !tradedAway && (
                  <span className="text-xs text-slate-600">No pick</span>
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
