"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  Settings as SettingsIcon,
  Lock,
  RefreshCw,
  UserPlus,
  UserMinus,
  Clock,
  ChevronDown,
  Trophy,
} from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { BackLink } from "@/components/ui/BackLink";

interface ActivityItem {
  id: string;
  type: "KEEPER_ADDED" | "KEEPER_REMOVED" | "KEEPER_LOCKED" | "TRADE" | "SETTINGS_CHANGED" | "SYNC";
  description: string;
  timestamp: string;
  actor: {
    id: string;
    name: string;
    avatar: string | null;
  } | null;
  metadata: Record<string, unknown>;
}

interface ActivityData {
  activities: ActivityItem[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  lastSyncedAt: string | null;
}

const activityIcons: Record<ActivityItem["type"], React.ReactNode> = {
  KEEPER_ADDED: <UserPlus size={16} className="text-emerald-400" />,
  KEEPER_REMOVED: <UserMinus size={16} className="text-red-400" />,
  KEEPER_LOCKED: <Lock size={16} className="text-amber-400" />,
  TRADE: <ArrowLeftRight size={16} className="text-blue-400" />,
  SETTINGS_CHANGED: <SettingsIcon size={16} className="text-purple-400" />,
  SYNC: <RefreshCw size={16} className="text-gray-400" />,
};

const activityColors: Record<ActivityItem["type"], string> = {
  KEEPER_ADDED: "border-l-emerald-500 bg-emerald-500/5",
  KEEPER_REMOVED: "border-l-red-500 bg-red-500/5",
  KEEPER_LOCKED: "border-l-amber-500 bg-amber-500/5",
  TRADE: "border-l-blue-500 bg-blue-500/5",
  SETTINGS_CHANGED: "border-l-purple-500 bg-purple-500/5",
  SYNC: "border-l-gray-500 bg-gray-500/5",
};

export default function ActivityPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<ActivityItem["type"] | "ALL">("ALL");
  const [showLoadMore, setShowLoadMore] = useState(false);

  const fetchData = useCallback(async (offset = 0, append = false) => {
    if (!append) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/activity?limit=50&offset=${offset}`);
      if (!res.ok) throw new Error("Failed to fetch activity");
      const result: ActivityData = await res.json();

      if (append && data) {
        setData({
          ...result,
          activities: [...data.activities, ...result.activities],
        });
      } else {
        setData(result);
      }
      setShowLoadMore(result.pagination.hasMore);
      setError("");
    } catch {
      setError("Failed to load activity");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [leagueId, data]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const filteredActivities = data?.activities.filter(
    (a) => filterType === "ALL" || a.type === filterType
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-48 mb-2" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <p className="text-red-400 font-medium">{error || "Failed to load"}</p>
          <button
            onClick={() => fetchData()}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
      {/* Premium Icon Gradient Definitions */}
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <BackLink href={`/league/${leagueId}`} label="Back to League" />
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 ring-1 ring-orange-500/20 flex items-center justify-center">
              <Activity className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Activity Feed
              </h1>
              <p className="text-gray-500 mt-0.5">Recent keeper and league activity</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => fetchData()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/50 hover:border-gray-600 text-sm font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              strokeWidth={2}
              className={isRefreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-500 text-sm">Filter:</span>
        {(["ALL", "KEEPER_ADDED", "KEEPER_REMOVED", "TRADE", "SETTINGS_CHANGED"] as const).map(
          (type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterType === type
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                  : "bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/50"
              }`}
            >
              {type === "ALL"
                ? "All"
                : type === "KEEPER_ADDED"
                ? "Keepers Added"
                : type === "KEEPER_REMOVED"
                ? "Keepers Removed"
                : type === "TRADE"
                ? "Trades"
                : "Settings"}
            </button>
          )
        )}
      </div>

      {/* Activity List */}
      <div className="space-y-3">
        {filteredActivities && filteredActivities.length > 0 ? (
          filteredActivities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              formatTimestamp={formatTimestamp}
            />
          ))
        ) : (
          <div className="bg-gray-800/40 rounded-2xl p-8 text-center border border-gray-700/40">
            <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No activity yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Activity will appear here as keepers are added and changes are made
            </p>
          </div>
        )}
      </div>

      {/* Load More */}
      {showLoadMore && (
        <div className="flex justify-center">
          <button
            onClick={() => fetchData(data.activities.length, true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800/50 text-gray-400 hover:text-white border border-gray-700/50 hover:border-gray-600 text-sm font-medium transition-all"
          >
            <ChevronDown size={16} />
            Load More
          </button>
        </div>
      )}

      {/* Last Sync Info */}
      {data.lastSyncedAt && (
        <div className="flex items-center justify-center gap-2 text-gray-500 text-xs">
          <Clock size={12} />
          <span>
            Last synced:{" "}
            {new Date(data.lastSyncedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}
    </div>
  );
}

function ActivityCard({
  activity,
  formatTimestamp,
}: {
  activity: ActivityItem;
  formatTimestamp: (ts: string) => string;
}) {
  const metadata = activity.metadata;

  return (
    <div
      className={`bg-gray-800/40 rounded-xl border border-gray-700/40 border-l-4 ${
        activityColors[activity.type]
      } p-4 transition-all hover:bg-gray-800/60`}
    >
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-900/50">
          {activityIcons[activity.type]}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium">{activity.description}</p>

          {/* Metadata details */}
          {activity.type === "KEEPER_ADDED" && Boolean(metadata.playerName) && (
            <div className="flex items-center gap-2 mt-2">
              <PositionBadge position={String(metadata.position || "")} size="xs" />
              <span className="text-gray-400 text-sm">
                {String(metadata.playerName)}
              </span>
              <span className="text-gray-500 text-sm">
                {String(metadata.team || "FA")}
              </span>
              {Boolean(metadata.cost) && (
                <span className="text-purple-400 text-sm font-medium">
                  Round {Number(metadata.cost)}
                </span>
              )}
              {metadata.keeperType === "FRANCHISE" && (
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded">
                  FT
                </span>
              )}
            </div>
          )}

          {activity.type === "TRADE" && Array.isArray(metadata.players) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {(metadata.players as Array<{ playerName: string }>).map(
                (player, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded"
                  >
                    {player.playerName}
                  </span>
                )
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-2">
            {activity.actor && (
              <span className="text-gray-500 text-xs">
                by {activity.actor.name}
              </span>
            )}
            <span className="text-gray-600 text-xs">
              {formatTimestamp(activity.timestamp)}
            </span>
          </div>
        </div>

        {activity.type === "KEEPER_ADDED" && (
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
            <Trophy size={16} />
          </div>
        )}
      </div>
    </div>
  );
}
