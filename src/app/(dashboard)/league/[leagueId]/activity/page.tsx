"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
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
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ScreenHeader,
  ScreenSkeleton,
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

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  });

/** Activity — scan what changed in the league (value-screens handoff). */
export default function ActivityPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [older, setOlder] = useState<ActivityItem[]>([]);
  const [moreToLoad, setMoreToLoad] = useState<boolean | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [filterType, setFilterType] = useState<ActivityItem["type"] | "ALL">("ALL");
  const [showFilters, setShowFilters] = useState(false);

  // The newest page lives in the SWR cache, so coming back to this tab paints
  // the feed you were looking at and revalidates behind it. Pages you loaded
  // by scrolling stay local — they are a scroll position, not state worth
  // restoring.
  const { data, error, isLoading, mutate } = useSWR<ActivityData>(
    `/api/leagues/${leagueId}/activity?limit=50&offset=0`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  // The newest page can be revalidated under the older ones, which shifts
  // every offset by however many events arrived — so the same event can come
  // back in both halves. Rows are keyed by id; dedupe before they collide.
  const activities = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    return [...data.activities, ...older].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [data, older]);
  const hasMore = moreToLoad ?? data?.pagination.hasMore ?? false;

  const loadMore = async () => {
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const res = await fetch(
        `/api/leagues/${leagueId}/activity?limit=50&offset=${activities.length}`
      );
      if (!res.ok) throw new Error("Failed to fetch activity");
      const page: ActivityData = await res.json();
      setOlder((prev) => [...prev, ...page.activities]);
      setMoreToLoad(page.pagination.hasMore);
    } catch {
      // A failed older page is not a failed screen — the feed above it is
      // still good, so say so on the button and leave the list alone.
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  // Cold only — the same shape loading.tsx drew, so the handover is invisible.
  if (isLoading && !data) {
    return <ScreenSkeleton rows={8} />;
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl">
        <div className="bg-[#0c1219] border border-rose-500/20 rounded-xl p-6">
          <p className="text-rose-400 font-medium">
            {error ? "Failed to load activity" : "Failed to load"}
          </p>
          <button
            onClick={() => mutate()}
            className="mt-4 px-5 py-2.5 min-h-[44px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 rounded-lg text-sm font-medium border border-rose-500/25 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const filtered = activities.filter(
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

      {hasMore && filterType === "ALL" && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full min-h-[44px] rounded-xl bg-[#0c1219] border border-white/[0.08] text-[13px] font-medium text-slate-400 hover:text-white transition-colors duration-150 disabled:opacity-50"
        >
          {loadingMore
            ? "Loading…"
            : moreFailed
              ? "Couldn't load older activity — try again"
              : "Load older activity"}
        </button>
      )}
    </div>
  );
}
