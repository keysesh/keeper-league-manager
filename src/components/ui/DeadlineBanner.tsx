"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Clock, X, Lock, ChevronRight, CalendarClock } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface DeadlineBannerProps {
  leagueId: string;
}

interface DeadlineStatus {
  source: "league" | "draft" | "none";
  deadline: string | null;
  draftStartTime: string | null;
  locked: boolean;
  lockReason: "deadline_passed" | "draft_started" | "draft_complete" | "superseded" | null;
  planningSeason: number;
}

function formatRemaining(deadline: Date, now: Date): string {
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return "passed";

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Keeper deadline banner — driven by real league data, never a hardcoded date.
 *
 * - League-configured deadline → "League keeper deadline"
 * - No league deadline but a scheduled Sleeper draft → labeled as the draft
 *   start (a fallback fact, not a commissioner rule)
 * - Nothing known → renders nothing rather than inventing a date
 */
export function DeadlineBanner({ leagueId }: DeadlineBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const { data: status } = useSWR<DeadlineStatus>(
    `/api/leagues/${leagueId}/deadline`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const dismissedKey = `deadline-banner-dismissed-${new Date().toDateString()}`;
    if (localStorage.getItem(dismissedKey) === "true") {
      setDismissed(true);
    }
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(`deadline-banner-dismissed-${new Date().toDateString()}`, "true");
  };

  if (dismissed || !status || !now) return null;

  // Locked: keeper changes are closed
  if (status.locked) {
    const message =
      status.lockReason === "draft_started"
        ? "The draft has started — keeper selections are closed"
        : status.lockReason === "draft_complete"
          ? `The ${status.planningSeason} draft is complete`
          : status.lockReason === "superseded"
            // Not a deadline at all: the reader is on last season's league row.
            // Saying "the deadline has passed" here would be a lie, and would
            // send someone hunting for an extension they do not need.
            ? `This is last season's league — open the ${status.planningSeason} league to set keepers`
            : "The keeper deadline has passed — selections are locked";

    return (
      <div className="relative mb-4 rounded-xl border border-red-500/25 bg-red-950/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <Lock className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="flex-1 text-sm text-red-300 font-medium">{message}</p>
          <button
            onClick={handleDismiss}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-red-400/60 hover:text-red-300 transition-colors"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  // No date known — say nothing rather than inventing one
  if (!status.deadline) return null;

  const deadline = new Date(status.deadline);
  const remaining = formatRemaining(deadline, now);
  const urgent = deadline.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;

  const label =
    status.source === "league"
      ? `League keeper deadline`
      : `Sleeper draft starts`; // fallback fact, labeled as such

  return (
    <div
      className={`relative mb-4 rounded-xl border px-4 py-3 ${
        urgent
          ? "border-amber-500/25 bg-amber-950/30"
          : "border-blue-500/20 bg-blue-950/20"
      }`}
    >
      <div className="flex items-center gap-3">
        {status.source === "league" ? (
          <Clock className={`w-4 h-4 flex-shrink-0 ${urgent ? "text-amber-400" : "text-blue-400"}`} />
        ) : (
          <CalendarClock className={`w-4 h-4 flex-shrink-0 ${urgent ? "text-amber-400" : "text-blue-400"}`} />
        )}
        <p className={`flex-1 text-sm font-medium ${urgent ? "text-amber-300" : "text-blue-300"}`}>
          {label}{" "}
          <span className="font-bold">
            {deadline.toLocaleDateString([], { month: "short", day: "numeric" })}
          </span>
          <span className={urgent ? "text-amber-400/80" : "text-blue-400/70"}> · {remaining} left</span>
        </p>
        <Link
          href={`/league/${leagueId}/keepers`}
          className={`hidden sm:flex items-center gap-1 text-sm font-medium transition-colors ${
            urgent ? "text-amber-400 hover:text-amber-300" : "text-blue-400 hover:text-blue-300"
          }`}
        >
          Set keepers <ChevronRight size={14} />
        </Link>
        <button
          onClick={handleDismiss}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
