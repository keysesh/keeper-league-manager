"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { cn } from "@/lib/design-tokens";

interface SheetPlayer {
  id: string;
  sleeperId: string;
  fullName: string;
  position: string | null;
  team: string | null;
  injuryStatus: string | null;
}

interface TradeAssetSheetProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  players: SheetPlayer[];
  selectedIds: string[];
  onToggle: (playerId: string) => void;
}

const POSITIONS = ["QB", "RB", "WR", "TE"] as const;

/**
 * Full-height player picker for the trade builder.
 *
 * Replaces the old nested max-h-64 scroll region (a scroll trap inside the
 * scrolling page) with a proper sheet: search, position filters, and
 * tap-to-toggle rows. The sheet's own scroll is the only scroll.
 */
export function TradeAssetSheet({
  isOpen,
  onClose,
  teamName,
  players,
  selectedIds,
  onToggle,
}: TradeAssetSheetProps) {
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) => {
      if (positionFilter && p.position !== positionFilter) return false;
      if (q && !p.fullName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [players, query, positionFilter]);

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={`Add players — ${teamName}`}>
      {/* Search */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players…"
          className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-[#0c1219] border border-white/[0.08] rounded-lg text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>

      {/* Position filter */}
      <div className="flex items-center gap-1.5 mb-3">
        <button
          onClick={() => setPositionFilter(null)}
          className={cn(
            "px-3 py-1.5 min-h-[36px] rounded-md text-xs font-semibold transition-colors",
            positionFilter === null
              ? "bg-blue-500/20 text-blue-300"
              : "bg-white/[0.04] text-slate-500 hover:text-slate-300"
          )}
        >
          All
        </button>
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            onClick={() => setPositionFilter(positionFilter === pos ? null : pos)}
            className={cn(
              "px-3 py-1.5 min-h-[36px] rounded-md text-xs font-semibold transition-colors",
              positionFilter === pos
                ? "bg-blue-500/20 text-blue-300"
                : "bg-white/[0.04] text-slate-500 hover:text-slate-300"
            )}
          >
            {pos}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500 tabular-nums">
          {selectedIds.length} selected
        </span>
      </div>

      {/* Player rows */}
      <div className="space-y-1">
        {filtered.map((player) => {
          const isSelected = selectedIds.includes(player.id);
          return (
            <button
              key={player.id}
              onClick={() => onToggle(player.id)}
              aria-pressed={isSelected}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 min-h-[48px] rounded-lg border text-left transition-colors",
                isSelected
                  ? "bg-blue-500/10 border-blue-500/30"
                  : "bg-[#0c1219] border-white/[0.06] active:bg-[#1c2840]"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-5 h-5 rounded border flex-shrink-0 transition-colors",
                  isSelected ? "bg-blue-500 border-blue-500" : "border-slate-600"
                )}
              >
                {isSelected && <Check size={13} className="text-white" strokeWidth={3} />}
              </span>
              <PlayerAvatar sleeperId={player.sleeperId} name={player.fullName} size="sm" />
              <PositionBadge position={player.position} size="xs" />
              <span className="flex-1 text-sm font-medium text-white truncate">
                {player.fullName}
              </span>
              {player.injuryStatus && player.injuryStatus !== "Active" && (
                <span className="text-red-400 text-[10px] font-medium px-1.5 py-0.5 bg-red-500/10 rounded flex-shrink-0">
                  {player.injuryStatus.slice(0, 3).toUpperCase()}
                </span>
              )}
              <span className="text-slate-500 text-xs flex-shrink-0">{player.team || "FA"}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-6">No players match</p>
        )}
      </div>

      {/* Done */}
      <button
        onClick={onClose}
        className="w-full mt-3 min-h-[48px] rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors"
      >
        Done
      </button>
    </Sheet>
  );
}
