"use client";

import useSWR from "swr";
import { Trophy, Users, ArrowLeftRight, Target, Crown, TrendingUp, Calendar } from "lucide-react";
import { PositionBadge } from "@/components/ui/PositionBadge";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface UserStats {
  user: {
    id: string;
    displayName: string | null;
    sleeperUsername: string;
    avatar: string | null;
    memberSince: string;
  };
  leagues: {
    total: number;
    asOwner: number;
    asCoOwner: number;
    active: number;
  };
  record: {
    totalWins: number;
    totalLosses: number;
    totalTies: number;
    winPercentage: number;
    totalPointsFor: number;
    totalPointsAgainst: number;
    avgPointsPerGame: number;
  };
  keepers: {
    totalKept: number;
    franchiseTagsUsed: number;
    regularKeepers: number;
    byPosition: Record<string, number>;
    topKeptPlayers: Array<{
      playerName: string;
      position: string | null;
      timesKept: number;
    }>;
  };
  trades: {
    totalTrades: number;
    playersAcquired: number;
    playersTraded: number;
    picksAcquired: number;
    picksTraded: number;
  };
  draftPicks: {
    totalOwned: number;
    byRound: Record<string, number>;
    futurePicks: number;
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color = "blue",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  color?: "blue" | "emerald" | "amber" | "purple" | "rose";
}) {
  const colorClasses = {
    blue: "text-blue-400 bg-blue-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    rose: "text-rose-400 bg-rose-500/10",
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  );
}

export default function ProfilePage() {
  const { data: stats, error, isLoading } = useSWR<UserStats>("/api/user/stats", fetcher);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-800 rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-800 rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-gray-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="text-center py-12">
          <p className="text-red-400">Failed to load profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-[#2a2a2a] rounded-xl p-6">
        <div className="flex items-center gap-4">
          {stats.user.avatar ? (
            <img
              src={`https://sleepercdn.com/avatars/thumbs/${stats.user.avatar}`}
              alt={stats.user.displayName || stats.user.sleeperUsername}
              className="w-16 h-16 rounded-full"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-2xl font-bold">
              {(stats.user.displayName || stats.user.sleeperUsername).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">
              {stats.user.displayName || stats.user.sleeperUsername}
            </h1>
            <p className="text-gray-400 text-sm">@{stats.user.sleeperUsername}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              <Calendar className="w-3 h-3" />
              <span>Member since {new Date(stats.user.memberSince).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Leagues"
          value={stats.leagues.total}
          subtext={`${stats.leagues.active} active`}
          color="blue"
        />
        <StatCard
          icon={Trophy}
          label="Win Rate"
          value={`${stats.record.winPercentage}%`}
          subtext={`${stats.record.totalWins}-${stats.record.totalLosses}-${stats.record.totalTies}`}
          color="emerald"
        />
        <StatCard
          icon={Crown}
          label="Keepers"
          value={stats.keepers.totalKept}
          subtext={`${stats.keepers.franchiseTagsUsed} franchise tags`}
          color="purple"
        />
        <StatCard
          icon={ArrowLeftRight}
          label="Trades"
          value={stats.trades.totalTrades}
          subtext={`${stats.trades.playersAcquired} acquired`}
          color="amber"
        />
      </div>

      {/* Detailed Stats Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Record Breakdown */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Career Record</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]">
              <span className="text-gray-400">Total Record</span>
              <span className="font-bold text-white">
                {stats.record.totalWins}-{stats.record.totalLosses}-{stats.record.totalTies}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]">
              <span className="text-gray-400">Win Percentage</span>
              <span className="font-bold text-emerald-400">{stats.record.winPercentage}%</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]">
              <span className="text-gray-400">Total Points For</span>
              <span className="font-bold text-white">{stats.record.totalPointsFor.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]">
              <span className="text-gray-400">Total Points Against</span>
              <span className="font-bold text-white">{stats.record.totalPointsAgainst.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Avg PPG</span>
              <span className="font-bold text-blue-400">{stats.record.avgPointsPerGame}</span>
            </div>
          </div>
        </div>

        {/* Keeper Breakdown */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Keeper History</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]">
              <span className="text-gray-400">Total Keepers</span>
              <span className="font-bold text-white">{stats.keepers.totalKept}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]">
              <span className="text-gray-400">Franchise Tags</span>
              <span className="font-bold text-amber-400">{stats.keepers.franchiseTagsUsed}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]">
              <span className="text-gray-400">Regular Keepers</span>
              <span className="font-bold text-blue-400">{stats.keepers.regularKeepers}</span>
            </div>
            <div className="py-2">
              <span className="text-gray-400 text-sm">By Position</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(stats.keepers.byPosition).map(([pos, count]) => (
                  <div key={pos} className="flex items-center gap-1.5 bg-[#222] px-2 py-1 rounded">
                    <PositionBadge position={pos} size="xs" />
                    <span className="text-xs font-medium text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Trade Activity */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowLeftRight className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Trade Activity</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]">
              <span className="text-gray-400">Total Trades</span>
              <span className="font-bold text-white">{stats.trades.totalTrades}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]">
              <span className="text-gray-400">Players Acquired</span>
              <span className="font-bold text-emerald-400">+{stats.trades.playersAcquired}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]">
              <span className="text-gray-400">Players Traded</span>
              <span className="font-bold text-rose-400">-{stats.trades.playersTraded}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]">
              <span className="text-gray-400">Picks Acquired</span>
              <span className="font-bold text-emerald-400">+{stats.trades.picksAcquired}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Picks Traded</span>
              <span className="font-bold text-rose-400">-{stats.trades.picksTraded}</span>
            </div>
          </div>
        </div>

        {/* Draft Capital */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Draft Capital</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]">
              <span className="text-gray-400">Total Picks Owned</span>
              <span className="font-bold text-white">{stats.draftPicks.totalOwned}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]">
              <span className="text-gray-400">Future Picks</span>
              <span className="font-bold text-blue-400">{stats.draftPicks.futurePicks}</span>
            </div>
            <div className="py-2">
              <span className="text-gray-400 text-sm">By Round</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(stats.draftPicks.byRound)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([round, count]) => (
                    <div
                      key={round}
                      className="flex items-center gap-1.5 bg-[#222] px-2 py-1 rounded"
                    >
                      <span className="text-xs text-gray-400">R{round}</span>
                      <span className="text-xs font-bold text-white">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Kept Players */}
      {stats.keepers.topKeptPlayers.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Most Kept Players</h2>
          </div>
          <div className="grid md:grid-cols-5 gap-3">
            {stats.keepers.topKeptPlayers.map((player, idx) => (
              <div
                key={player.playerName}
                className="bg-[#222] rounded-lg p-3 text-center border border-[#2a2a2a]"
              >
                <div
                  className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold ${
                    idx === 0
                      ? "bg-amber-400/20 text-amber-400"
                      : idx === 1
                      ? "bg-gray-400/20 text-gray-300"
                      : idx === 2
                      ? "bg-orange-400/20 text-orange-400"
                      : "bg-gray-700/50 text-gray-400"
                  }`}
                >
                  {idx + 1}
                </div>
                <p className="text-sm font-medium text-white truncate">{player.playerName}</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  {player.position && <PositionBadge position={player.position} size="xs" />}
                  <span className="text-xs text-gray-500">{player.timesKept}x kept</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
