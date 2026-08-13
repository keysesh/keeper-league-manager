"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Star } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { cn } from "@/lib/design-tokens";

export interface HandoffKeeper {
  /** Stable key — the player's Sleeper ID */
  sleeperId: string;
  playerName: string;
  position: string | null;
  /** Final round after cascade — the number to enter in Sleeper */
  finalCost: number;
  type: string; // "FRANCHISE" | "REGULAR"
}

export interface HandoffVerification {
  verifiable: boolean;
  entries: Array<{
    playerSleeperId: string;
    plannedRound: number;
    sleeperRound: number | null;
    state: "matches" | "wrong_round" | "not_set";
  }>;
  unexpected: Array<{ playerName: string; sleeperRound: number | null }>;
}

interface SleeperHandoffSheetProps {
  isOpen: boolean;
  onClose: () => void;
  keepers: HandoffKeeper[];
  season: number;
  leagueName: string;
  teamName: string;
  sleeperLeagueId: string;
  rosterId: string;
  /** Round-trip verification against Sleeper's synced draft board (optional) */
  verification?: HandoffVerification | null;
}

/**
 * "Set these in Sleeper" — the manual-entry checklist.
 *
 * Sleeper's API is read-only, so committing keepers is a human action on
 * Sleeper's draft board. This sheet shows exactly what to enter (player +
 * final round + franchise designation), ordered for fast entry, with a
 * persistent per-item check-off, a copyable summary for league chat, and
 * a link out to the league on Sleeper.
 */
export function SleeperHandoffSheet({
  isOpen,
  onClose,
  keepers,
  season,
  leagueName,
  teamName,
  sleeperLeagueId,
  rosterId,
  verification,
}: SleeperHandoffSheetProps) {
  const storageKey = `sleeper-handoff-${rosterId}-${season}`;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  // Load persisted check-off state (hydration from localStorage)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      // Corrupt state — start fresh
    }
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggle = (sleeperId: string) => {
    setChecked((prev) => {
      const next = { ...prev, [sleeperId]: !prev[sleeperId] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Storage full/unavailable — check-off just won't persist
      }
      return next;
    });
  };

  const sorted = [...keepers].sort((a, b) => a.finalCost - b.finalCost);
  const doneCount = sorted.filter((k) => checked[k.sleeperId]).length;

  const copyText = async () => {
    const lines = [
      `${leagueName} ${season} Keepers — ${teamName}`,
      ...sorted.map(
        (k) =>
          `R${k.finalCost}  ${k.playerName} (${k.position || "?"})${
            k.type === "FRANCHISE" ? " — Franchise Tag" : ""
          }`
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — nothing to do
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Set these in Sleeper">
      <p className="text-sm text-slate-400 mb-1">
        Sleeper can&apos;t be updated automatically — set each keeper on your
        Sleeper draft board, then check it off here.
      </p>
      <p className="text-xs text-slate-600 mb-4">
        In Sleeper: League → Drafts → tap your slot in the listed round.
      </p>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">
          No keepers selected yet — nothing to enter.
        </p>
      ) : (
        <>
          {/* Progress */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${sorted.length ? (doneCount / sorted.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 tabular-nums flex-shrink-0">
              {doneCount}/{sorted.length} entered
            </span>
          </div>

          {/* Verification status vs Sleeper's synced draft board */}
          {verification && !verification.verifiable && (
            <p className="mb-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-slate-500">
              Verification pending — Sleeper hasn&apos;t published keeper placements
              for the {season} draft board yet. Once they appear in a sync, each
              entry below shows whether it matches your plan.
            </p>
          )}
          {verification?.verifiable && verification.unexpected.length > 0 && (
            <p className="mb-3 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/25 text-xs text-amber-400">
              On Sleeper but not in your plan:{" "}
              {verification.unexpected
                .map((u) => `${u.playerName}${u.sleeperRound ? ` (R${u.sleeperRound})` : ""}`)
                .join(", ")}
            </p>
          )}

          {/* Checklist ordered by round */}
          <div className="space-y-1.5 mb-4">
            {sorted.map((k) => {
              const isDone = !!checked[k.sleeperId];
              const verifyEntry = verification?.verifiable
                ? verification.entries.find((e) => e.playerSleeperId === k.sleeperId)
                : null;
              return (
                <button
                  key={k.sleeperId}
                  onClick={() => toggle(k.sleeperId)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 min-h-[52px] rounded-lg border text-left transition-colors",
                    isDone
                      ? "bg-emerald-500/[0.07] border-emerald-500/30"
                      : "bg-[#0c1219] border-white/[0.08] active:bg-[#1c2840]"
                  )}
                  aria-pressed={isDone}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-md border flex-shrink-0 transition-colors",
                      isDone
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-slate-600 bg-transparent"
                    )}
                  >
                    {isDone && <Check size={14} className="text-white" strokeWidth={3} />}
                  </span>

                  <span className="inline-flex items-center justify-center min-w-[42px] px-2 py-1 rounded-md bg-white/[0.06] text-white text-sm font-bold tabular-nums flex-shrink-0">
                    R{k.finalCost}
                  </span>

                  <span className="flex-1 min-w-0 flex items-center gap-1.5">
                    <PositionBadge position={k.position} size="xs" />
                    <span
                      className={cn(
                        "text-sm font-semibold truncate",
                        isDone ? "text-slate-400 line-through" : "text-white"
                      )}
                    >
                      {k.playerName}
                    </span>
                    {k.type === "FRANCHISE" && (
                      <Star size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                    )}
                  </span>

                  {/* Round-trip verification badge (evidence from Sleeper only) */}
                  {verifyEntry && (
                    <span
                      className={cn(
                        "flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded",
                        verifyEntry.state === "matches" &&
                          "bg-emerald-500/15 text-emerald-400",
                        verifyEntry.state === "wrong_round" &&
                          "bg-rose-500/15 text-rose-400",
                        verifyEntry.state === "not_set" &&
                          "bg-white/[0.06] text-slate-500"
                      )}
                      title={
                        verifyEntry.state === "matches"
                          ? "Sleeper's board matches your plan"
                          : verifyEntry.state === "wrong_round"
                            ? `Sleeper shows R${verifyEntry.sleeperRound}, plan says R${verifyEntry.plannedRound}`
                            : "Not on Sleeper's board yet"
                      }
                    >
                      {verifyEntry.state === "matches"
                        ? "✓ Verified"
                        : verifyEntry.state === "wrong_round"
                          ? `Sleeper: R${verifyEntry.sleeperRound}`
                          : "Not set"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {/* Same-context navigation on purpose: a new-tab target spawned a
                browser tab/window on every tap (two taps = two Sleeper tabs)
                and, in the installed Home-Screen app, punted the user out to
                Safari. A plain anchor keeps one browsing context — standalone
                mode shows Sleeper in the in-app view with a Done button back
                to Keeper, Safari returns via Back. Sleeper's universal links
                don't cover /leagues/* on iOS, so no navigation style can
                force the native app open there. */}
            <a
              href={`https://sleeper.com/leagues/${sleeperLeagueId}`}
              rel="noreferrer"
              className="flex items-center justify-center gap-2 min-h-[48px] rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-bold transition-colors"
            >
              <ExternalLink size={16} />
              Open Sleeper
            </a>
            <button
              onClick={copyText}
              className="flex items-center justify-center gap-2 min-h-[44px] rounded-lg bg-[#141c2b] hover:bg-[#1c2840] border border-white/[0.08] text-slate-300 hover:text-white text-sm font-medium transition-colors"
            >
              {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
              {copied ? "Copied!" : "Copy list for league chat"}
            </button>
            <p className="text-[11px] text-slate-600 text-center">
              Opens your league on sleeper.com — use Done or Back to return
              here. On Android this may open the Sleeper app; iPhone doesn&apos;t
              support jumping straight into it.
            </p>
          </div>
        </>
      )}
    </Sheet>
  );
}
