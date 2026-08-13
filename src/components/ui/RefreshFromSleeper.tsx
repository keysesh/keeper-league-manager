"use client";

import { useState } from "react";
import useSWR from "swr";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/design-tokens";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface RefreshFromSleeperProps {
  leagueId: string;
  /** Called after a successful refresh so the page can revalidate its data */
  onRefreshed?: () => void;
  /** Compact: icon button + short timestamp (for tight toolbars/trays) */
  compact?: boolean;
  className?: string;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "unknown";
  const diffMin = Math.floor((Date.now() - then) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 48) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

/**
 * The single user-facing freshness control:
 * "Updated from Sleeper [time]" + one Refresh action.
 *
 * Internally the refresh still runs the full pipeline (league sync →
 * populate keepers → recalculate years) — the user never has to know which
 * stage repairs which staleness. A failed refresh keeps the old timestamp:
 * stale data is never presented as current.
 */
export function RefreshFromSleeper({
  leagueId,
  onRefreshed,
  compact = false,
  className,
}: RefreshFromSleeperProps) {
  const { success, error: showError } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const { data, mutate } = useSWR<{ lastSyncedAt: string | null }>(
    `/api/leagues/${leagueId}/deadline`,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 60000 }
  );

  const refresh = async () => {
    setRefreshing(true);
    setFailed(false);
    try {
      // One composite server action: rosters + traded picks + current-season
      // draft board + keeper populate/recalculate. The server only advances
      // lastSyncedAt if every stage succeeds, so a partial refresh can never
      // masquerade as "just updated".
      const res = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh-planning", leagueId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Refresh from Sleeper failed");
      }

      await mutate(); // refresh the timestamp from the server
      onRefreshed?.();
      success("Updated from Sleeper");
    } catch (err) {
      setFailed(true);
      showError(err instanceof Error ? err.message : "Refresh from Sleeper failed");
    } finally {
      setRefreshing(false);
    }
  };

  const timestamp = relativeTime(data?.lastSyncedAt ?? null);

  if (compact) {
    return (
      <button
        onClick={refresh}
        disabled={refreshing}
        className={cn(
          "inline-flex items-center gap-1.5 min-h-[40px] px-2.5 rounded-lg bg-[#141c2b] text-slate-400 hover:text-white hover:bg-[#1c2840] border border-white/[0.08] text-xs font-medium transition-all disabled:opacity-50",
          failed && "border-amber-500/40 text-amber-400",
          className
        )}
        title={`Updated from Sleeper ${timestamp}`}
      >
        {failed ? (
          <AlertTriangle size={14} />
        ) : (
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
        )}
        <span className="hidden sm:inline">
          {refreshing ? "Refreshing…" : failed ? "Retry" : timestamp}
        </span>
      </button>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "text-xs",
          failed ? "text-amber-400" : "text-slate-500"
        )}
      >
        {failed ? "Refresh failed — showing data from " : "Updated from Sleeper "}
        {timestamp}
      </span>
      <button
        onClick={refresh}
        disabled={refreshing}
        className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-lg bg-[#141c2b] text-slate-400 hover:text-white hover:bg-[#1c2840] border border-white/[0.08] text-xs font-medium transition-all disabled:opacity-50"
      >
        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
        {refreshing ? "Refreshing…" : "Refresh from Sleeper"}
      </button>
    </div>
  );
}
