"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface Roster {
  id: string;
  sleeperId: string;
  teamName: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  isUserRoster: boolean;
  owners: Array<{
    id: string;
    displayName: string;
    avatar: string | null;
    role: string;
  }>;
  playerCount: number;
  keeperCount: number;
  currentKeepers: Array<{
    id: string;
    player: {
      fullName: string;
      position: string;
      team: string;
    };
    type: string;
    finalCost: number;
  }>;
}

interface League {
  id: string;
  sleeperId: string;
  name: string;
  season: number;
  status: string;
  totalRosters: number;
  draftRounds: number;
  lastSyncedAt: string | null;
  keeperSettings: {
    maxKeepers: number;
    maxFranchiseTags: number;
    maxRegularKeepers: number;
    regularKeeperMaxYears: number;
    undraftedRound: number;
  } | null;
  rosters: Roster[];
  recentDrafts: Array<{
    id: string;
    season: number;
    type: string;
    status: string;
  }>;
  counts: {
    rosters: number;
    drafts: number;
    transactions: number;
  };
}

export default function LeaguePage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.leagueId as string;
  const { success, error: showError } = useToast();

  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchLeague();
  }, [leagueId]);

  const fetchLeague = async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch league");
      }
      const data = await res.json();
      setLeague(data);
    } catch {
      setError("Failed to load league");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sleeper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quick",
          leagueId,
        }),
      });

      if (!res.ok) {
        throw new Error("Sync failed");
      }

      await fetchLeague();
      success("League synced successfully");
    } catch {
      showError("Failed to sync league");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-4 w-32" />
            ))}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-8" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <Skeleton className="h-6 w-24 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error || "League not found"}</p>
        </div>
      </div>
    );
  }

  const userRoster = league.rosters.find((r) => r.isUserRoster);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{league.name}</h1>
          <p className="text-gray-400 mt-1">
            {league.season} Season &bull; {league.totalRosters} Teams &bull;{" "}
            {league.status.replace("_", " ")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm text-white transition-colors"
          >
            {syncing ? "Syncing..." : "Sync from Sleeper"}
          </button>
          <Link
            href={`/league/${leagueId}/draft-board`}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm text-white transition-colors"
          >
            View Draft Board
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Your Record"
          value={
            userRoster
              ? `${userRoster.wins}-${userRoster.losses}${userRoster.ties > 0 ? `-${userRoster.ties}` : ""}`
              : "N/A"
          }
        />
        <StatCard
          label="Your Points"
          value={userRoster?.pointsFor.toFixed(1) || "0"}
        />
        <StatCard
          label="Keepers Set"
          value={`${userRoster?.keeperCount || 0}/${league.keeperSettings?.maxKeepers || 7}`}
        />
        <StatCard
          label="Last Synced"
          value={
            league.lastSyncedAt
              ? new Date(league.lastSyncedAt).toLocaleDateString()
              : "Never"
          }
        />
      </div>

      {/* Keeper Settings Summary */}
      {league.keeperSettings && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">
            Keeper Rules
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Max Keepers:</span>{" "}
              <span className="text-white">{league.keeperSettings.maxKeepers}</span>
            </div>
            <div>
              <span className="text-gray-400">Franchise Tags:</span>{" "}
              <span className="text-white">{league.keeperSettings.maxFranchiseTags}</span>
            </div>
            <div>
              <span className="text-gray-400">Regular Keepers:</span>{" "}
              <span className="text-white">{league.keeperSettings.maxRegularKeepers}</span>
            </div>
            <div>
              <span className="text-gray-400">Max Years (Regular):</span>{" "}
              <span className="text-white">{league.keeperSettings.regularKeeperMaxYears}</span>
            </div>
            <div>
              <span className="text-gray-400">Undrafted Round:</span>{" "}
              <span className="text-white">{league.keeperSettings.undraftedRound}</span>
            </div>
          </div>
        </div>
      )}

      {/* Your Team Quick View */}
      {userRoster && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Your Team: {userRoster.teamName || "Unnamed Team"}
            </h2>
            <Link
              href={`/league/${leagueId}/team/${userRoster.id}`}
              className="text-purple-400 hover:text-purple-300 text-sm"
            >
              Manage Keepers &rarr;
            </Link>
          </div>

          {userRoster.currentKeepers.length > 0 ? (
            <div className="space-y-2">
              {userRoster.currentKeepers.map((keeper) => (
                <div
                  key={keeper.id}
                  className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        keeper.type === "FRANCHISE"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {keeper.type === "FRANCHISE" ? "FT" : "K"}
                    </span>
                    <PositionBadge position={keeper.player.position} size="xs" />
                    <span className="text-white">{keeper.player.fullName}</span>
                    <span className="text-gray-500 text-sm">{keeper.player.team}</span>
                  </div>
                  <span className="text-gray-400">Round {keeper.finalCost}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No keepers selected yet</p>
          )}
        </div>
      )}

      {/* League Standings */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Standings</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                <th className="pb-3 pr-4">#</th>
                <th className="pb-3 pr-4">Team</th>
                <th className="pb-3 pr-4 text-center">Record</th>
                <th className="pb-3 pr-4 text-right">PF</th>
                <th className="pb-3 pr-4 text-right">PA</th>
                <th className="pb-3 text-center">Keepers</th>
              </tr>
            </thead>
            <tbody>
              {league.rosters.map((roster, index) => (
                <tr
                  key={roster.id}
                  className={`border-b border-gray-700/50 ${
                    roster.isUserRoster ? "bg-purple-500/10" : ""
                  }`}
                >
                  <td className="py-3 pr-4 text-gray-500">{index + 1}</td>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/league/${leagueId}/team/${roster.id}`}
                      className="text-white hover:text-purple-400 transition-colors"
                    >
                      {roster.teamName || "Team " + roster.sleeperId}
                      {roster.isUserRoster && (
                        <span className="ml-2 text-xs text-purple-400">(You)</span>
                      )}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-center text-gray-300">
                    {roster.wins}-{roster.losses}
                    {roster.ties > 0 && `-${roster.ties}`}
                  </td>
                  <td className="py-3 pr-4 text-right text-gray-300">
                    {roster.pointsFor.toFixed(1)}
                  </td>
                  <td className="py-3 pr-4 text-right text-gray-300">
                    {roster.pointsAgainst.toFixed(1)}
                  </td>
                  <td className="py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        roster.keeperCount >= (league.keeperSettings?.maxKeepers || 7)
                          ? "bg-green-500/20 text-green-400"
                          : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {roster.keeperCount}/{league.keeperSettings?.maxKeepers || 7}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NavCard
          href={`/league/${leagueId}/draft-board`}
          title="Draft Board"
          description="View the keeper draft board with cascade calculations"
          icon="📋"
        />
        <NavCard
          href={`/league/${leagueId}/trade-analyzer`}
          title="Trade Analyzer"
          description="Analyze potential trades and keeper implications"
          icon="🔄"
        />
        <NavCard
          href={`/league/${leagueId}/history`}
          title="History"
          description="View historical keeper data and trends"
          icon="📈"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function NavCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-purple-500/50 transition-colors group"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-white group-hover:text-purple-400 transition-colors">
        {title}
      </h3>
      <p className="text-gray-400 text-sm mt-1">{description}</p>
    </Link>
  );
}
