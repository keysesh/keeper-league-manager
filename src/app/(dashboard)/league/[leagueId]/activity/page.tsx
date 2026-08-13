"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  EditorialScreen,
  EditorialHeader,
  Hairline,
  Footnote,
  rowHairline,
} from "@/components/editorial";
import { cn } from "@/lib/design-tokens";

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  actor: { id: string; name: string; avatar: string | null } | null;
}

interface ActivityData {
  activities: ActivityItem[];
  pagination: { limit: number; offset: number; hasMore: boolean };
  lastSyncedAt: string | null;
}

const WINDOW_DAYS = 30;

/** "TODAY" / "AUG 12" style group label. */
function dayLabel(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return "TODAY";
  return date
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

/** "5:08p" / "11:20a" style timestamp. */
function clockLabel(ts: string): string {
  const date = new Date(ts);
  let h = date.getHours();
  const suffix = h >= 12 ? "p" : "a";
  h = h % 12 || 12;
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}${suffix}`;
}

export default function ActivityPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

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
      <EditorialScreen>
        <div className="px-5 pt-2 space-y-4">
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-52 w-full rounded-md" />
        </div>
      </EditorialScreen>
    );
  }

  if (error || !data) {
    return (
      <EditorialScreen>
        <EditorialHeader title="Activity" sub={`last ${WINDOW_DAYS} days`} />
        <Hairline top />
        <div className="px-5 py-4">
          <p className="text-[13px] text-[#d4674a]">{error || "Failed to load"}</p>
          <button
            onClick={() => fetchData()}
            className="mt-3 text-[13px] font-medium text-[#a8ac9d] underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      </EditorialScreen>
    );
  }

  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = data.activities.filter(
    (a) => new Date(a.timestamp).getTime() >= cutoff
  );

  // Group consecutive entries by day
  const groups: Array<{ label: string; items: ActivityItem[] }> = [];
  for (const item of recent) {
    const label = dayLabel(item.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <EditorialScreen>
      <EditorialHeader title="Activity" sub={`last ${WINDOW_DAYS} days`} />

      {groups.length === 0 && (
        <>
          <Hairline top />
          <div className="px-5 py-6 text-[13px] leading-[1.55] text-[#93a08f]">
            Nothing in the last {WINDOW_DAYS} days. Keeper declarations, trades
            and settings changes will appear here.
          </div>
        </>
      )}

      {groups.map((group, gi) => (
        <div key={`${group.label}-${gi}`}>
          <div
            className={cn(
              "px-5 pb-2 text-[11px] leading-none font-medium text-[#93a08f] tracking-[0.06em]",
              gi > 0 && "pt-5"
            )}
          >
            {group.label}
          </div>
          <Hairline top />
          {group.items.map((item) => (
            <div key={item.id} className={cn("flex gap-3.5 px-5 py-[13px]", rowHairline)}>
              <span className="w-11 shrink-0 font-plex-mono text-[11px] leading-[1.5] text-[#93a08f]">
                {clockLabel(item.timestamp)}
              </span>
              <span className="text-[13px] leading-[1.55] text-[#ded7c8]">
                {item.actor && !item.description.startsWith(item.actor.name) && (
                  <b className="font-medium text-[#eee7da]">{item.actor.name} </b>
                )}
                {item.description}
              </span>
            </div>
          ))}
        </div>
      ))}

      {data.pagination.hasMore && (
        <button
          onClick={() => fetchData(data.activities.length, true)}
          disabled={loadingMore}
          className={cn(
            "w-full text-left px-5 py-3 min-h-[44px] text-[13px] font-medium text-[#a8ac9d] disabled:opacity-50",
            rowHairline
          )}
        >
          {loadingMore ? "Loading…" : "Load older activity"}
        </button>
      )}

      <Footnote>Showing the most recent league activity.</Footnote>
    </EditorialScreen>
  );
}
