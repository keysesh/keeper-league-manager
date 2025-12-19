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
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">{league.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-sm font-semibold rounded-full">
              {league.season}
            </span>
            <span className="text-gray-500">{league.totalRosters} Teams</span>
            <span className="text-gray-600">&bull;</span>
            <span className="text-gray-500 capitalize">{league.status.replace("_", " ")}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-all border border-gray-700 hover:border-gray-600"
          >
            {syncing ? "Syncing..." : "Sync Data"}
          </button>
          <Link
            href={`/league/${leagueId}/draft-board`}
            className="btn-premium px-5 py-2.5 rounded-xl text-sm text-white"
          >
            Draft Board
          </Link>
        </div>
      </div>

      {/* Quick Stats - Square Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Record"
          value={
            userRoster
              ? `${userRoster.wins}-${userRoster.losses}${userRoster.ties > 0 ? `-${userRoster.ties}` : ""}`
              : "N/A"
          }
          accent="blue"
        />
        <StatCard
          label="Points For"
          value={userRoster?.pointsFor.toFixed(1) || "0"}
          accent="green"
        />
        <StatCard
          label="Keepers"
          value={`${userRoster?.keeperCount || 0}/${league.keeperSettings?.maxKeepers || 7}`}
          accent="purple"
        />
        <StatCard
          label="Synced"
          value={
            league.lastSyncedAt
              ? new Date(league.lastSyncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "Never"
          }
        />
      </div>

      {/* Keeper Settings Summary */}
      {league.keeperSettings && (
        <div className="card-premium rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
            <span className="w-1 h-5 bg-purple-500 rounded-full"></span>
            Keeper Rules
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{league.keeperSettings.maxKeepers}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Max Keepers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">{league.keeperSettings.maxFranchiseTags}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Franchise Tags</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-400">{league.keeperSettings.maxRegularKeepers}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Regular</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{league.keeperSettings.regularKeeperMaxYears}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Max Years</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-400">{league.keeperSettings.undraftedRound}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Undrafted Rd</p>
            </div>
          </div>
        </div>
      )}

      {/* Your Team Quick View */}
      {userRoster && (
        <div className="card-premium rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-1 h-5 bg-green-500 rounded-full"></span>
              {userRoster.teamName || "Your Team"}
            </h2>
            <Link
              href={`/league/${leagueId}/team/${userRoster.id}`}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-semibold text-white transition-colors"
            >
              Manage Keepers
            </Link>
          </div>

          {userRoster.currentKeepers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {userRoster.currentKeepers.map((keeper) => (
                <div
                  key={keeper.id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 bg-gray-800/60 border-l-4 transition-all hover:bg-gray-800/80 ${
                    keeper.player.position === "QB" ? "border-l-red-500" :
                    keeper.player.position === "RB" ? "border-l-green-500" :
                    keeper.player.position === "WR" ? "border-l-blue-500" :
                    keeper.player.position === "TE" ? "border-l-orange-500" : "border-l-gray-500"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          keeper.type === "FRANCHISE"
                            ? "badge-franchise"
                            : "badge-keeper"
                        }`}
                      >
                        {keeper.type === "FRANCHISE" ? "FT" : "K"}
                      </span>
                      <PositionBadge position={keeper.player.position} size="xs" />
                    </div>
                    <p className="text-white font-semibold mt-1 truncate">{keeper.player.fullName}</p>
                    <p className="text-gray-500 text-xs">{keeper.player.team}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">R{keeper.finalCost}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No keepers selected yet</p>
              <Link
                href={`/league/${leagueId}/team/${userRoster.id}`}
                className="text-purple-400 hover:text-purple-300 text-sm mt-2 inline-block"
              >
                Select your keepers
              </Link>
            </div>
          )}
        </div>
      )}

      {/* League Standings */}
      <div className="card-premium rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
          <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
          Standings
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full table-premium">
            <thead>
              <tr className="text-left border-b border-gray-700/50">
                <th className="pb-3 pr-4 text-gray-500 text-xs font-semibold uppercase tracking-wider">#</th>
                <th className="pb-3 pr-4 text-gray-500 text-xs font-semibold uppercase tracking-wider">Team</th>
                <th className="pb-3 pr-4 text-center text-gray-500 text-xs font-semibold uppercase tracking-wider">Record</th>
                <th className="pb-3 pr-4 text-right text-gray-500 text-xs font-semibold uppercase tracking-wider">PF</th>
                <th className="pb-3 pr-4 text-right text-gray-500 text-xs font-semibold uppercase tracking-wider">PA</th>
                <th className="pb-3 text-center text-gray-500 text-xs font-semibold uppercase tracking-wider">Keepers</th>
              </tr>
            </thead>
            <tbody>
              {league.rosters.map((roster, index) => (
                <tr
                  key={roster.id}
                  className={`border-b border-gray-800/50 transition-colors ${
                    roster.isUserRoster ? "bg-purple-500/10" : "hover:bg-gray-800/30"
                  }`}
                >
                  <td className="py-4 pr-4">
                    <span className={`text-sm font-bold ${index < 3 ? "text-amber-400" : "text-gray-600"}`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <Link
                      href={`/league/${leagueId}/team/${roster.id}`}
                      className="text-white hover:text-purple-400 transition-colors font-medium"
                    >
                      {roster.teamName || "Team " + roster.sleeperId}
                      {roster.isUserRoster && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full font-semibold">You</span>
                      )}
                    </Link>
                  </td>
                  <td className="py-4 pr-4 text-center">
                    <span className="text-white font-semibold">
                      {roster.wins}-{roster.losses}
                      {roster.ties > 0 && `-${roster.ties}`}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-right text-gray-400">
                    {roster.pointsFor.toFixed(1)}
                  </td>
                  <td className="py-4 pr-4 text-right text-gray-400">
                    {roster.pointsAgainst.toFixed(1)}
                  </td>
                  <td className="py-4 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        roster.keeperCount >= (league.keeperSettings?.maxKeepers || 7)
                          ? "bg-green-500/20 text-green-400"
                          : roster.keeperCount > 0
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-gray-800 text-gray-500"
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

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "purple" | "gold" | "green" | "blue" }) {
  const accentStyles = {
    purple: "border-purple-500/30 hover:border-purple-500/50",
    gold: "border-amber-500/30 hover:border-amber-500/50",
    green: "border-green-500/30 hover:border-green-500/50",
    blue: "border-blue-500/30 hover:border-blue-500/50",
  };

  return (
    <div className={`stat-card aspect-square flex flex-col items-center justify-center text-center ${accent ? accentStyles[accent] : ""}`}>
      <p className="text-4xl font-extrabold text-white tracking-tight">{value}</p>
      <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-wide">{label}</p>
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
      className="card-premium rounded-2xl p-6 transition-all duration-300 group hover:scale-[1.02]"
    >
      <div className="text-4xl mb-4 opacity-80 group-hover:opacity-100 transition-opacity">{icon}</div>
      <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">
        {title}
      </h3>
      <p className="text-gray-500 text-sm mt-2 leading-relaxed">{description}</p>
    </Link>
  );
}
