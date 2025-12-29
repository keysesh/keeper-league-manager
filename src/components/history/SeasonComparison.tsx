"use client";

import { useMemo, useState } from "react";
import { PositionBadge } from "@/components/ui/PositionBadge";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRightLeft,
  Users,
  Repeat,
  AlertCircle,
} from "lucide-react";

interface KeeperHistory {
  id: string;
  season: number;
  type: string;
  baseCost: number;
  finalCost: number;
  yearsKept: number;
  player: {
    id: string;
    fullName: string;
    position: string | null;
    team: string | null;
  };
  roster: {
    id: string;
    teamName: string | null;
  };
}

interface SeasonComparisonProps {
  keepers: KeeperHistory[];
  seasons: number[];
}

interface ComparisonData {
  player: {
    id: string;
    fullName: string;
    position: string | null;
  };
  season1Data: KeeperHistory | null;
  season2Data: KeeperHistory | null;
  status: "retained" | "dropped" | "new" | "traded";
  costChange: number | null;
}

export function SeasonComparison({ keepers, seasons }: SeasonComparisonProps) {
  const [season1, setSeason1] = useState<number>(seasons[1] || seasons[0]);
  const [season2, setSeason2] = useState<number>(seasons[0]);

  const comparisonData = useMemo(() => {
    const season1Keepers = keepers.filter((k) => k.season === season1);
    const season2Keepers = keepers.filter((k) => k.season === season2);

    const allPlayerIds = new Set([
      ...season1Keepers.map((k) => k.player.id),
      ...season2Keepers.map((k) => k.player.id),
    ]);

    const comparisons: ComparisonData[] = [];

    allPlayerIds.forEach((playerId) => {
      const s1Data = season1Keepers.find((k) => k.player.id === playerId);
      const s2Data = season2Keepers.find((k) => k.player.id === playerId);

      let status: ComparisonData["status"];
      if (s1Data && s2Data) {
        if (s1Data.roster.id === s2Data.roster.id) {
          status = "retained";
        } else {
          status = "traded";
        }
      } else if (s1Data && !s2Data) {
        status = "dropped";
      } else {
        status = "new";
      }

      const costChange =
        s1Data && s2Data ? s2Data.finalCost - s1Data.finalCost : null;

      comparisons.push({
        player: {
          id: playerId,
          fullName: (s1Data || s2Data)!.player.fullName,
          position: (s1Data || s2Data)!.player.position,
        },
        season1Data: s1Data || null,
        season2Data: s2Data || null,
        status,
        costChange,
      });
    });

    // Sort: retained first, then by player name
    return comparisons.sort((a, b) => {
      const statusOrder = { retained: 0, traded: 1, new: 2, dropped: 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return a.player.fullName.localeCompare(b.player.fullName);
    });
  }, [keepers, season1, season2]);

  const stats = useMemo(() => {
    const retained = comparisonData.filter((c) => c.status === "retained").length;
    const traded = comparisonData.filter((c) => c.status === "traded").length;
    const dropped = comparisonData.filter((c) => c.status === "dropped").length;
    const newKeepers = comparisonData.filter((c) => c.status === "new").length;
    const avgCostChange =
      comparisonData
        .filter((c) => c.costChange !== null)
        .reduce((sum, c) => sum + (c.costChange || 0), 0) /
      (comparisonData.filter((c) => c.costChange !== null).length || 1);

    return { retained, traded, dropped, newKeepers, avgCostChange };
  }, [comparisonData]);

  if (seasons.length < 2) {
    return (
      <div className="card-premium rounded-2xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">
          Need at least 2 seasons of data for comparison
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Season Selectors */}
      <div className="card-premium rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-blue-400" />
          Season Comparison
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-gray-400 mb-2">
              From Season
            </label>
            <select
              value={season1}
              onChange={(e) => setSeason1(parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {seasons.map((s) => (
                <option key={s} value={s} disabled={s === season2}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-center pt-6">
            <ArrowRightLeft className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-gray-400 mb-2">
              To Season
            </label>
            <select
              value={season2}
              onChange={(e) => setSeason2(parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {seasons.map((s) => (
                <option key={s} value={s} disabled={s === season1}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Retained"
          value={stats.retained}
          icon={<Repeat className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          label="Traded"
          value={stats.traded}
          icon={<ArrowRightLeft className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Dropped"
          value={stats.dropped}
          icon={<TrendingDown className="w-5 h-5" />}
          color="red"
        />
        <StatCard
          label="New"
          value={stats.newKeepers}
          icon={<TrendingUp className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          label="Avg Cost Δ"
          value={stats.avgCostChange > 0 ? `+${stats.avgCostChange.toFixed(1)}` : stats.avgCostChange.toFixed(1)}
          icon={stats.avgCostChange >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          color={stats.avgCostChange > 0 ? "red" : "green"}
          isRound
        />
      </div>

      {/* Comparison Table */}
      <div className="card-premium rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Player Movement
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-900/50">
                <th className="px-6 py-4 text-left text-gray-400 text-sm font-semibold uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-4 text-center text-gray-400 text-sm font-semibold uppercase tracking-wider">
                  {season1}
                </th>
                <th className="px-6 py-4 text-center text-gray-400 text-sm font-semibold uppercase tracking-wider">
                  {season2}
                </th>
                <th className="px-6 py-4 text-center text-gray-400 text-sm font-semibold uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-gray-400 text-sm font-semibold uppercase tracking-wider">
                  Cost Δ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {comparisonData.map((comparison) => (
                <tr
                  key={comparison.player.id}
                  className="hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <PositionBadge
                        position={comparison.player.position}
                        size="sm"
                      />
                      <span className="text-white font-medium">
                        {comparison.player.fullName}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {comparison.season1Data ? (
                      <div className="text-sm">
                        <p className="text-white font-medium">
                          Rd {comparison.season1Data.finalCost}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {comparison.season1Data.roster.teamName || "Unknown"}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {comparison.season2Data ? (
                      <div className="text-sm">
                        <p className="text-white font-medium">
                          Rd {comparison.season2Data.finalCost}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {comparison.season2Data.roster.teamName || "Unknown"}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={comparison.status} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    {comparison.costChange !== null ? (
                      <CostChangeBadge change={comparison.costChange} />
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retention by Position */}
      <div className="card-premium rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Repeat className="w-5 h-5 text-green-400" />
          Retention by Position
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["QB", "RB", "WR", "TE"].map((pos) => {
            const positionData = comparisonData.filter(
              (c) => c.player.position === pos
            );
            const retained = positionData.filter(
              (c) => c.status === "retained" || c.status === "traded"
            ).length;
            const s1Total = positionData.filter((c) => c.season1Data).length;
            const rate = s1Total > 0 ? Math.round((retained / s1Total) * 100) : 0;

            return (
              <div
                key={pos}
                className="text-center p-4 rounded-xl bg-gray-800/30"
              >
                <PositionBadge position={pos} size="md" />
                <p className="text-2xl font-bold text-white mt-3">{rate}%</p>
                <p className="text-gray-500 text-sm mt-1">Retention Rate</p>
                <p className="text-gray-600 text-xs mt-1">
                  {retained} of {s1Total} kept
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  isRound = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: "green" | "red" | "blue" | "amber" | "purple";
  isRound?: boolean;
}) {
  const colorClasses = {
    green: "bg-green-500/20 text-green-400",
    red: "bg-red-500/20 text-red-400",
    blue: "bg-blue-500/20 text-blue-400",
    amber: "bg-amber-500/20 text-amber-400",
    purple: "bg-purple-500/20 text-purple-400",
  };

  return (
    <div className="card-premium rounded-xl p-4 text-center">
      <div
        className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mx-auto mb-2`}
      >
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">
        {isRound ? value : value}
      </p>
      <p className="text-gray-500 text-sm">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ComparisonData["status"] }) {
  const config = {
    retained: {
      bg: "bg-green-500/20",
      text: "text-green-400",
      label: "Retained",
    },
    traded: {
      bg: "bg-blue-500/20",
      text: "text-blue-400",
      label: "Traded",
    },
    dropped: {
      bg: "bg-red-500/20",
      text: "text-red-400",
      label: "Dropped",
    },
    new: {
      bg: "bg-amber-500/20",
      text: "text-amber-400",
      label: "New",
    },
  };

  const { bg, text, label } = config[status];

  return (
    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${bg} ${text}`}>
      {label}
    </span>
  );
}

function CostChangeBadge({ change }: { change: number }) {
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-gray-400">
        <Minus className="w-3 h-3" />
        <span className="text-sm font-medium">0</span>
      </span>
    );
  }

  const isPositive = change > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const colorClass = isPositive ? "text-red-400" : "text-green-400";

  return (
    <span className={`inline-flex items-center gap-1 ${colorClass}`}>
      <Icon className="w-3 h-3" />
      <span className="text-sm font-medium">
        {isPositive ? "+" : ""}
        {change}
      </span>
    </span>
  );
}
