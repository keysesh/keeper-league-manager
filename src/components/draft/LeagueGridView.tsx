"use client";

import { Star, Lock } from "lucide-react";
import { cn } from "@/lib/design-tokens";
import { managerHues, teamWash } from "@/lib/design/identity";
import { buildDraftGrid, isBorrowed } from "@/lib/keeper/draft-grid";

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
  draftSlot?: number | null;
  results: KeeperResult[];
  tradedAwayPicks: number[];
  acquiredPicks: Array<{ round: number; fromRosterId: string }>;
}

interface LeagueGridViewProps {
  cascade: TeamCascade[];
  draftRounds: number;
  userRosterId?: string;
  onPlayerClick?: (playerId: string) => void;
}

const CELL_W = 118;
const CELL_H = 74;
const TEAM_W = 156;

/** Position colours, the PositionBadge palette resolved for inline use. */
const POSITION: Record<string, { fg: string; bg: string; bd: string }> = {
  QB: { fg: "#f87171", bg: "rgba(239,68,68,.15)", bd: "rgba(239,68,68,.25)" },
  RB: { fg: "#34d399", bg: "rgba(16,185,129,.15)", bd: "rgba(16,185,129,.25)" },
  WR: { fg: "#60a5fa", bg: "rgba(59,130,246,.15)", bd: "rgba(59,130,246,.25)" },
  TE: { fg: "#fbbf24", bg: "rgba(245,158,11,.15)", bd: "rgba(245,158,11,.25)" },
  K: { fg: "#a78bfa", bg: "rgba(139,92,246,.15)", bd: "rgba(139,92,246,.25)" },
};
const NO_POSITION = { fg: "#94a3b8", bg: "rgba(100,116,139,.15)", bd: "rgba(100,116,139,.25)" };

/**
 * The league board as the draft will be run: a row per team in running order,
 * a column per round, a cell per pick.
 *
 * The per-team view answers "what do I hold". This answers "what happens at
 * this pick" — which is the question the night before a draft, and the one a
 * list of your own rounds cannot answer, because a pick you traded away still
 * happens at your slot, with someone else making it.
 */
export function LeagueGridView({
  cascade,
  draftRounds,
  userRosterId,
  onPlayerClick,
}: LeagueGridViewProps) {
  // Running order when Sleeper has published one; otherwise the order the
  // league came back in, which at least stays stable between renders.
  const teams = [...cascade].sort((a, b) => {
    const as = a.draftSlot ?? Number.MAX_SAFE_INTEGER;
    const bs = b.draftSlot ?? Number.MAX_SAFE_INTEGER;
    return as - bs || cascade.indexOf(a) - cascade.indexOf(b);
  });

  const nameOf = new Map(teams.map((t) => [t.rosterId, t.rosterName || "Team"]));
  const hues = managerHues(teams.map((t) => t.rosterId));

  const grid = buildDraftGrid(
    draftRounds,
    teams.map((t) => ({
      rosterId: t.rosterId,
      keepers: t.results,
      acquiredPicks: t.acquiredPicks,
    }))
  );

  return (
    <div className="-mx-4 overflow-x-auto scrollbar-thin px-4">
      <div className="min-w-max rounded-xl border border-white/[0.08] border-t-white/[0.12] bg-[#0a0e15] overflow-hidden">
        {/* Round numbers */}
        <div className="flex">
          <div
            className="sticky left-0 z-20 flex items-center bg-[#0c1219] px-3 border-r border-white/[0.08] border-b border-white/[0.08]"
            style={{ width: TEAM_W, height: 32 }}
          >
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Draft slot
            </span>
          </div>
          {Array.from({ length: draftRounds }, (_, i) => (
            <div
              key={i}
              className="flex items-center justify-center bg-[#0c1219] border-r border-white/[0.05] border-b border-white/[0.08]"
              style={{ width: CELL_W, height: 32 }}
            >
              <span className="font-numeral text-[16px] leading-none text-slate-400">{i + 1}</span>
            </div>
          ))}
        </div>

        {grid.rows.map((row, rowIndex) => {
          const team = teams[rowIndex];
          const isUser = team.rosterId === userRosterId;
          const hue = hues.get(team.rosterId);

          return (
            <div key={team.rosterId} className="flex">
              {/* Team */}
              <div
                className={cn(
                  "sticky left-0 z-10 flex items-center gap-2.5 px-3 border-r border-white/[0.08] border-b border-white/[0.05]",
                  isUser ? "bg-[#111a27]" : "bg-[#0c1219]"
                )}
                style={{ width: TEAM_W, height: CELL_H }}
              >
                <span className="font-numeral w-4 shrink-0 text-[18px] leading-none text-slate-600">
                  {team.draftSlot ?? rowIndex + 1}
                </span>
                <span
                  className="h-8 w-[3px] shrink-0 rounded-sm"
                  style={{ background: hue }}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[11.5px] font-semibold text-slate-100">
                    {team.rosterName || "Team"}
                  </span>
                  {isUser && (
                    <span className="text-[9.5px] text-slate-500">you</span>
                  )}
                </span>
              </div>

              {/* Picks */}
              {row.cells.map((cell) => {
                const k = cell.keeper;
                const borrowed = isBorrowed(cell);
                const holder = borrowed ? nameOf.get(cell.heldBy) : null;
                const label = `${cell.round}.${team.draftSlot ?? rowIndex + 1}`;

                if (!k) {
                  return (
                    <div
                      key={cell.round}
                      className="flex flex-col justify-between bg-[#0a0e15] px-2 py-1.5 border-r border-white/[0.05] border-b border-white/[0.05]"
                      style={{ width: CELL_W, height: CELL_H }}
                    >
                      <span className="font-mono text-[9px] text-slate-700">{label}</span>
                      {borrowed ? (
                        <span className="truncate text-[9.5px] font-semibold text-emerald-400/90">
                          →&#8202;{holder}
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-slate-700">Open</span>
                      )}
                    </div>
                  );
                }

                const pos = POSITION[(k.position || "").toUpperCase()] ?? NO_POSITION;
                const [first, ...rest] = k.playerName.split(" ");
                const last = rest.join(" ") || first;

                return (
                  <button
                    key={cell.round}
                    onClick={() => onPlayerClick?.(k.playerId)}
                    className="flex flex-col justify-between px-2 py-1.5 text-left border-r border-white/[0.05] border-b border-white/[0.05]"
                    style={{ width: CELL_W, height: CELL_H, background: teamWash(k.team, 0.38) }}
                  >
                    <span className="flex items-center gap-1">
                      <span className="font-mono text-[9px] text-slate-500">{label}</span>
                      {k.keeperType === "FRANCHISE" && (
                        <Star size={8} className="fill-amber-400 text-amber-400" />
                      )}
                      {k.isLocked && <Lock size={8} className="text-slate-500" />}
                      <span
                        className="ml-auto rounded-[3px] border px-1 text-[8.5px] font-semibold tracking-[0.06em]"
                        style={{ color: pos.fg, background: pos.bg, borderColor: pos.bd }}
                      >
                        {(k.position || "").toUpperCase()}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-col leading-[1.15]">
                      {rest.length > 0 && (
                        <span className="truncate text-[9.5px] text-slate-400">{first}</span>
                      )}
                      <span className="truncate text-[12px] font-semibold text-white">{last}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-[9px] tracking-[0.03em] text-slate-500">
                        {k.team || "FA"}
                      </span>
                      {borrowed && (
                        <span className="truncate text-[9px] font-semibold text-emerald-400/90">
                          →&#8202;{holder}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
