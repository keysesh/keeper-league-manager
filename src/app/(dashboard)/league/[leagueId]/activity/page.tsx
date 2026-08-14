"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Repeat,
  Lock,
  UserPlus,
  UserMinus,
  Clock,
  RefreshCw,
  Filter,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ScreenHeader,
  SectionLabel,
  listCard,
} from "@/components/league-screens";
import { cn } from "@/lib/design-tokens";

interface ActivityItem {
  id: string;
  type: "KEEPER_ADDED" | "KEEPER_REMOVED" | "KEEPER_LOCKED" | "TRADE" | "SETTINGS_CHANGED" | "SYNC";
  description: string;
  timestamp: string;
  actor: { id: string; name: string; avatar: string | null } | null;
}

interface ActivityData {
  activities: ActivityItem[];
  pagination: { limit: number; offset: number; hasMore: boolean };
  lastSyncedAt: string | null;
}

// Event-type icon tiles (value-screens handoff): gradient wash + tinted border
const EVENT_STYLE: Record<
  ActivityItem["type"],
  { icon: LucideIcon; color: string; tile: string; border: string }
> = {
  TRADE: {
    icon: Repeat,
    color: "#a78bfa",
    tile: "linear-gradient(135deg, rgba(167,139,250,.25), rgba(167,139,250,.12))",
    border: "rgba(167,139,250,.25)",
  },
  KEEPER_ADDED: {
    icon: Lock,
    color: "#60a5fa",
    tile: "linear-gradient(135deg, rgba(96,165,250,.25), rgba(96,165,250,.12))",
    border: "rgba(96,165,250,.25)",
  },
  KEEPER_LOCKED: {
    icon: Lock,
    color: "#60a5fa",
    tile: "linear-gradient(135deg, rgba(96,165,250,.25), rgba(96,165,250,.12))",
    border: "rgba(96,165,250,.25)",
  },
  KEEPER_REMOVED: {
    icon: UserMinus,
    color: "#fb7185",
    tile: "linear-gradient(135deg, rgba(251,113,133,.25), rgba(251,113,133,.12))",
    border: "rgba(251,113,133,.25)",
  },
  SETTINGS_CHANGED: {
    icon: Clock,
    color: "#fbbf24",
    tile: "linear-gradient(135deg, rgba(251,191,36,.25), rgba(251,191,36,.12))",
    border: "rgba(251,191,36,.25)",
  },
  SYNC: {
    icon: RefreshCw,
    color: "#94a3b8",
    tile: "linear-gradient(135deg, rgba(148,163,184,.25), rgba(148,163,184,.12))",
    border: "rgba(148,163,184,.25)",
  },
};

// Waiver-style adds share the emerald user-plus treatment when the
// description reads like a claim rather than a keeper action.
const WAIVER_STYLE = {
  icon: UserPlus,
  color: "#34d399",
  tile: "linear-gradient(135deg, rgba(52,211,153,.25), rgba(52,211,153,.12))",
  border: "rgba(52,211,153,.25)",
};

function dayLabel(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

function relativeTime(ts: string): string {
  const diffMs = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Activity — scan what changed in the league (value-screens handoff). */
export default function ActivityPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterType, setFilterType] = useState<ActivityItem["type"] | "ALL">("ALL");
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(
    async (offset = 0, append = false) => {
      if (append) setLoadingMore(true);
      try {
        const res = await fetch(
          `/api/leagues/${leagueId}/activity?limit=50&offset=${offset}`
        );
        if (!res.ok) throw new Error("Failed to fetch activity");
        const result: ActivityData = await res.json();
        setData((prev) =>
          append && prev
            ? { ...result, activities: [...prev.activities, ...result.activities] }
            : result
        );
        setError("");
      } catch {
        setError("Failed to load activity");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [leagueId]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-12 w-40 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl">
        <div className="bg-[#0c1219] border border-rose-500/20 rounded-xl p-6">
          <p className="text-rose-400 font-medium">{error || "Failed to load"}</p>
          <button
            onClick={() => fetchData()}
            className="mt-4 px-5 py-2.5 min-h-[44px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 rounded-lg text-sm font-medium border border-rose-500/25 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const filtered = data.activities.filter(
    (a) => filterType === "ALL" || a.type === filterType
  );

  // Group consecutive entries by day
  const groups: Array<{ label: string; items: ActivityItem[] }> = [];
  for (const item of filtered) {
    const label = dayLabel(item.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <ScreenHeader
        title="Activity"
        subtitle="Recent keeper and league activity"
        right={
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Filter activity"
            className={cn(
              "flex items-center justify-center w-11 h-11 -mt-2 -mr-3 rounded-lg transition-colors duration-150",
              showFilters || filterType !== "ALL"
                ? "text-blue-400 bg-[#1c2840]"
                : "text-slate-400 hover:text-white hover:bg-[#1c2840]"
            )}
          >
            <Filter size={17} />
          </button>
        }
      />

      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {(["ALL", "KEEPER_ADDED", "KEEPER_REMOVED", "TRADE", "SETTINGS_CHANGED"] as const).map(
            (type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "px-3 py-1.5 min-h-[32px] rounded-lg text-xs font-medium border transition-colors duration-150",
                  filterType === type
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    : "bg-[#0c1219] text-slate-400 border-white/[0.08] hover:text-white"
                )}
              >
                {type === "ALL"
                  ? "All"
                  : type === "KEEPER_ADDED"
                    ? "Keepers"
                    : type === "KEEPER_REMOVED"
                      ? "Removed"
                      : type === "TRADE"
                        ? "Trades"
                        : "Commissioner"}
              </button>
            )
          )}
        </div>
      )}

      {groups.length === 0 && (
        <EmptyState
          title="No recent activity"
          description="Keeper declarations, trades and settings changes will appear here."
        />
      )}

      {groups.map((group, gi) => (
        <div key={`${group.label}-${gi}`}>
          <SectionLabel label={group.label} />
          <div className={listCard}>
            {group.items.map((item) => {
              const isWaiver =
                item.type === "KEEPER_ADDED" && /waiver|claim/i.test(item.description);
              const style = isWaiver ? WAIVER_STYLE : EVENT_STYLE[item.type];
              const Icon = style.icon;
              return (
                <div key={item.id} className="flex items-start gap-3 px-[13px] py-3">
                  <span
                    className="flex items-center justify-center w-8 h-8 rounded-lg border shrink-0"
                    style={{ background: style.tile, borderColor: style.border, color: style.color }}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] leading-[1.4] text-slate-200">
                      {item.actor && !item.description.startsWith(item.actor.name) && (
                        <b className="font-semibold text-slate-50">{item.actor.name} </b>
                      )}
                      {item.description}
                    </span>
                    <span className="block font-mono text-[11px] text-slate-500 mt-1.5">
                      {relativeTime(item.timestamp)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {data.pagination.hasMore && filterType === "ALL" && (
        <button
          onClick={() => fetchData(data.activities.length, true)}
          disabled={loadingMore}
          className="w-full min-h-[44px] rounded-xl bg-[#0c1219] border border-white/[0.08] text-[13px] font-medium text-slate-400 hover:text-white transition-colors duration-150 disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load older activity"}
        </button>
      )}
    </div>
  );
}
