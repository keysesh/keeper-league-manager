"use client";

import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/design-tokens";

interface KeeperResult {
  playerId: string;
  playerName: string;
  finalCost: number;
  keeperType?: "FRANCHISE" | "REGULAR";
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
  status: "available" | "keeper" | "traded";
  tradedTo?: string;
}

/**
 * "Mine" — the viewer's own draft rounds as an editorial pick list
 * (design handoff Aug 2026): 20px-wide mono round number, kept players at
 * 13.5/500 with a right-aligned amber "tag" marker, traded picks as
 * "to <team>" with an outbound arrow, open picks as an em dash, and
 * multi-pick rounds as a nested column with a note.
 */
export function MyPicksList({
  cascade,
  draftBoard,
  draftRounds,
  rosterId,
  onPlayerClick,
}: {
  cascade: TeamCascade[];
  draftBoard: Array<{ round: number; slots: BoardSlot[] }>;
  draftRounds: number;
  rosterId: string;
  onPlayerClick?: (playerId: string) => void;
}) {
  const team = cascade.find((t) => t.rosterId === rosterId);
  if (!team) return null;

  const nameOf = new Map(cascade.map((t) => [t.rosterId, t.rosterName || "a team"]));
  const rowBorder = "border-b border-[rgba(214,255,232,.10)]";

  return (
    <div className="tabular-nums">
      <div className="border-t border-[rgba(214,255,232,.10)]" />
      {Array.from({ length: draftRounds }, (_, i) => {
        const round = i + 1;
        const keepers = team.results.filter((k) => k.finalCost === round);
        const tradedAway = team.tradedAwayPicks.includes(round);
        const acquired = team.acquiredPicks.filter((p) => p.round === round);
        const slot = draftBoard
          .find((r) => r.round === round)
          ?.slots.find((s) => s.rosterId === rosterId);

        const multi = keepers.length > 1;

        return (
          <div
            key={round}
            className={cn(
              "flex gap-3.5 px-5 py-[13px]",
              rowBorder,
              !multi && "items-center"
            )}
          >
            <span
              className={cn(
                "w-5 shrink-0 font-plex-mono text-xs leading-none font-medium text-[#93a08f]",
                multi && "pt-0.5"
              )}
            >
              {round}
            </span>

            {multi ? (
              <span className="flex-1 min-w-0 grid gap-2.5">
                {keepers.map((k) => (
                  <KeptLine key={k.playerId} keeper={k} onPlayerClick={onPlayerClick} />
                ))}
                <span className="text-[11.5px] leading-none text-[#93a08f]">
                  {keepers.length === 2 ? "two" : keepers.length} picks this round
                </span>
                {tradedAway && (
                  <span className="text-[11.5px] leading-none text-[#93a08f]">
                    base pick to {slot?.tradedTo || "another team"}
                  </span>
                )}
              </span>
            ) : keepers.length === 1 ? (
              <span className="flex-1 min-w-0 flex items-center gap-3.5">
                <KeptLine keeper={keepers[0]} onPlayerClick={onPlayerClick} className="flex-1" />
                {tradedAway && (
                  <span className="text-[11.5px] leading-none text-[#93a08f] shrink-0">
                    base to {slot?.tradedTo || "—"}
                  </span>
                )}
              </span>
            ) : tradedAway ? (
              <>
                <span className="flex-1 min-w-0 text-[13px] leading-none text-[#93a08f] whitespace-nowrap overflow-hidden text-ellipsis">
                  to {slot?.tradedTo || "another team"}
                </span>
                <ArrowUpRight size={13} strokeWidth={1.9} className="text-[#93a08f] shrink-0" />
              </>
            ) : (
              <span className="flex-1 min-w-0 text-[13px] leading-none text-[#93a08f]">
                —
                {acquired.length > 0 && (
                  <>
                    {" "}plus {acquired.length === 1 ? "one" : acquired.length} from{" "}
                    {acquired.map((a) => nameOf.get(a.fromRosterId)).join(", ")}
                  </>
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function KeptLine({
  keeper,
  onPlayerClick,
  className,
}: {
  keeper: KeeperResult;
  onPlayerClick?: (playerId: string) => void;
  className?: string;
}) {
  const Tag = onPlayerClick ? "button" : "span";
  return (
    <Tag
      onClick={onPlayerClick ? () => onPlayerClick(keeper.playerId) : undefined}
      className={cn("flex items-center gap-3.5 min-w-0 text-left", className)}
    >
      <span className="flex-1 min-w-0 text-[13.5px] leading-none font-medium whitespace-nowrap overflow-hidden text-ellipsis">
        {keeper.playerName}
      </span>
      {keeper.keeperType === "FRANCHISE" && (
        <span className="font-plex-mono text-[11.5px] leading-none text-[#c9922f] shrink-0">
          tag
        </span>
      )}
    </Tag>
  );
}
