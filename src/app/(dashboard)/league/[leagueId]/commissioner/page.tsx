"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Settings,
  Lock,
  Unlock,
  Trash2,
  RefreshCw,
  ChevronLeft,
  Check,
  X,
  Edit,
  Users,
  History,
} from "lucide-react";
import { BackLink } from "@/components/ui/BackLink";

interface KeeperData {
  id: string;
  player: { id: string; fullName: string; position: string };
  roster: { id: string; teamName: string };
  type: "FRANCHISE" | "REGULAR";
  baseCost: number;
  finalCost: number;
  yearsKept: number;
  isLocked: boolean;
  notes?: string;
  season: number;
  createdAt: string;
}

interface RosterData {
  id: string;
  teamName: string;
  owner?: { displayName?: string; sleeperUsername?: string };
  playerCount: number;
  keeperCount: number;
  keepers: KeeperData[];
}

interface SettingsData {
  maxKeepers: number;
  maxFranchiseTags: number;
  maxRegularKeepers: number;
  regularKeeperMaxYears: number;
  undraftedRound: number;
  minimumRound: number;
  costReductionPerYear: number;
}

export default function CommissionerPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.leagueId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [activeTab, setActiveTab] = useState<"keepers" | "settings" | "activity">("keepers");

  const [leagueName, setLeagueName] = useState("");
  const [rosters, setRosters] = useState<RosterData[]>([]);
  const [keepers, setKeepers] = useState<KeeperData[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [activity, setActivity] = useState<{ id: string; action: string; entity: string; createdAt: string }[]>([]);

  const [selectedRoster, setSelectedRoster] = useState<string | null>(null);
  const [editingKeeper, setEditingKeeper] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [leagueId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/leagues/${leagueId}/commissioner`);
      if (res.status === 403) {
        setError("You don't have commissioner access to this league");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch data");

      const data = await res.json();
      setLeagueName(data.league.name);
      setRosters(data.rosters);
      setKeepers(data.keepers);
      setSettings(data.settings);
      setActivity(data.recentActivity);
    } catch {
      setError("Failed to load commissioner data");
    } finally {
      setLoading(false);
    }
  };

  const performAction = async (action: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/commissioner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ text: data.message, type: "success" });
        fetchData();
      } else {
        setMessage({ text: data.error || "Action failed", type: "error" });
      }
    } catch {
      setMessage({ text: "Failed to perform action", type: "error" });
    }

    setTimeout(() => setMessage(null), 5000);
  };

  const handleLockAll = (lock: boolean) => {
    performAction({ action: "lockKeepers", lock });
  };

  const handleDeleteKeeper = (keeperId: string) => {
    performAction({ action: "deleteKeeper", keeperId });
    setConfirmDelete(null);
  };

  const handleUpdateSettings = (updates: Partial<SettingsData>) => {
    performAction({ action: "updateSettings", settings: updates });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-800 rounded w-24 mb-3"></div>
          <div className="h-10 bg-gray-800 rounded w-64 mb-2"></div>
          <div className="h-5 bg-gray-800 rounded w-48 mb-8"></div>
          <div className="h-64 bg-gray-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="card-premium rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-red-400">{error}</p>
          <Link
            href={`/league/${leagueId}`}
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to League
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <BackLink href={`/league/${leagueId}`} label="Back to League" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 ring-1 ring-amber-500/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Commissioner Tools</h1>
            <p className="text-gray-500 mt-0.5">{leagueName}</p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 ${
            message.type === "success"
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {message.type === "success" ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-800/30 rounded-xl w-fit">
        {[
          { id: "keepers", label: "Keepers", icon: Users },
          { id: "settings", label: "Settings", icon: Settings },
          { id: "activity", label: "Activity", icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-amber-500 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700/50"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "keepers" && (
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleLockAll(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl border border-red-500/20 transition-colors"
            >
              <Lock className="w-4 h-4" />
              Lock All Keepers
            </button>
            <button
              onClick={() => handleLockAll(false)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl border border-emerald-500/20 transition-colors"
            >
              <Unlock className="w-4 h-4" />
              Unlock All Keepers
            </button>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 rounded-xl border border-gray-700/50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* Roster List */}
          <div className="space-y-4">
            {rosters.map((roster) => (
              <div
                key={roster.id}
                className="card-premium rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setSelectedRoster(selectedRoster === roster.id ? null : roster.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                      {roster.teamName?.[0] || "?"}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-white">{roster.teamName}</p>
                      <p className="text-sm text-gray-500">
                        {roster.owner?.displayName || roster.owner?.sleeperUsername || "Unknown"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-white font-medium">{roster.keeperCount} keepers</p>
                      <p className="text-xs text-gray-500">{roster.playerCount} players</p>
                    </div>
                    <ChevronLeft
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        selectedRoster === roster.id ? "-rotate-90" : ""
                      }`}
                    />
                  </div>
                </button>

                {selectedRoster === roster.id && (
                  <div className="border-t border-gray-700/50 p-4 space-y-3">
                    {roster.keepers.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-4">No keepers set</p>
                    ) : (
                      roster.keepers.map((keeper) => (
                        <div
                          key={keeper.id}
                          className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded ${
                                keeper.type === "FRANCHISE"
                                  ? "bg-purple-500/20 text-purple-400"
                                  : "bg-blue-500/20 text-blue-400"
                              }`}
                            >
                              {keeper.type}
                            </span>
                            <div>
                              <p className="text-white font-medium">{keeper.player.fullName}</p>
                              <p className="text-xs text-gray-500">
                                {keeper.player.position} | Round {keeper.finalCost} | Year {keeper.yearsKept}
                              </p>
                            </div>
                            {keeper.isLocked && (
                              <Lock className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingKeeper(keeper.id)}
                              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4 text-gray-400" />
                            </button>
                            {confirmDelete === keeper.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDeleteKeeper(keeper.id)}
                                  className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg"
                                >
                                  <Check className="w-4 h-4 text-red-400" />
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="p-2 hover:bg-gray-700 rounded-lg"
                                >
                                  <X className="w-4 h-4 text-gray-400" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(keeper.id)}
                                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "settings" && settings && (
        <div className="card-premium rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-white">Keeper Rules</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SettingInput
              label="Max Keepers"
              value={settings.maxKeepers}
              onChange={(v) => handleUpdateSettings({ maxKeepers: v })}
            />
            <SettingInput
              label="Max Franchise Tags"
              value={settings.maxFranchiseTags}
              onChange={(v) => handleUpdateSettings({ maxFranchiseTags: v })}
            />
            <SettingInput
              label="Max Regular Keepers"
              value={settings.maxRegularKeepers}
              onChange={(v) => handleUpdateSettings({ maxRegularKeepers: v })}
            />
            <SettingInput
              label="Regular Keeper Max Years"
              value={settings.regularKeeperMaxYears}
              onChange={(v) => handleUpdateSettings({ regularKeeperMaxYears: v })}
            />
            <SettingInput
              label="Undrafted Player Round"
              value={settings.undraftedRound}
              onChange={(v) => handleUpdateSettings({ undraftedRound: v })}
            />
            <SettingInput
              label="Minimum Round (no earlier)"
              value={settings.minimumRound}
              onChange={(v) => handleUpdateSettings({ minimumRound: v })}
            />
            <SettingInput
              label="Cost Reduction Per Year"
              value={settings.costReductionPerYear}
              onChange={(v) => handleUpdateSettings({ costReductionPerYear: v })}
            />
          </div>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="card-premium rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>

          {activity.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {activity.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
                >
                  <div>
                    <p className="text-white">
                      <span className="text-amber-400">{log.action}</span> on {log.entity}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(log.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(value);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">{label}</label>
      <div className="flex gap-2">
        <input
          type="number"
          value={localValue}
          onChange={(e) => setLocalValue(parseInt(e.target.value) || 0)}
          className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none"
        />
        {localValue !== value && (
          <button
            onClick={() => onChange(localValue)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
}
