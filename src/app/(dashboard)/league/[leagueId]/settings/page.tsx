"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface KeeperSettings {
  maxKeepers: number;
  maxFranchiseTags: number;
  maxRegularKeepers: number;
  regularKeeperMaxYears: number;
  undraftedRound: number;
  minimumRound: number;
  costReductionPerYear: number;
}

interface League {
  id: string;
  name: string;
  season: number;
  totalRosters: number;
  draftRounds: number;
  keeperSettings: KeeperSettings | null;
}

export default function SettingsPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;

  const [league, setLeague] = useState<League | null>(null);
  const [settings, setSettings] = useState<KeeperSettings>({
    maxKeepers: 7,
    maxFranchiseTags: 2,
    maxRegularKeepers: 5,
    regularKeeperMaxYears: 2,
    undraftedRound: 8,
    minimumRound: 1,
    costReductionPerYear: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchLeague();
  }, [leagueId]);

  const fetchLeague = async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}`);
      if (!res.ok) throw new Error("Failed to fetch league");
      const data = await res.json();
      setLeague(data);
      if (data.keeperSettings) {
        setSettings(data.keeperSettings);
      }
    } catch {
      setError("Failed to load league settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/leagues/${leagueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keeperSettings: settings }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      setSuccess("Settings saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof KeeperSettings, value: number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">League not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/league/${leagueId}`}
          className="text-gray-400 hover:text-white text-sm mb-2 inline-block"
        >
          &larr; Back to League
        </Link>
        <h1 className="text-2xl font-bold text-white">League Settings</h1>
        <p className="text-gray-400 mt-1">{league.name} - {league.season} Season</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <p className="text-green-400">{success}</p>
        </div>
      )}

      {/* Keeper Limits */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Keeper Limits</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SettingInput
            label="Max Total Keepers"
            description="Maximum keepers each team can have"
            value={settings.maxKeepers}
            onChange={(v) => updateSetting("maxKeepers", v)}
            min={1}
            max={15}
          />
          <SettingInput
            label="Max Franchise Tags"
            description="Maximum franchise-tagged players"
            value={settings.maxFranchiseTags}
            onChange={(v) => updateSetting("maxFranchiseTags", v)}
            min={0}
            max={5}
          />
          <SettingInput
            label="Max Regular Keepers"
            description="Maximum regular keepers (non-franchise)"
            value={settings.maxRegularKeepers}
            onChange={(v) => updateSetting("maxRegularKeepers", v)}
            min={0}
            max={15}
          />
        </div>
      </div>

      {/* Keeper Rules */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Keeper Rules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingInput
            label="Regular Keeper Max Years"
            description="How many consecutive years a regular keeper can be kept"
            value={settings.regularKeeperMaxYears}
            onChange={(v) => updateSetting("regularKeeperMaxYears", v)}
            min={1}
            max={10}
          />
          <SettingInput
            label="Cost Reduction Per Year"
            description="How many rounds earlier the keeper costs each year"
            value={settings.costReductionPerYear}
            onChange={(v) => updateSetting("costReductionPerYear", v)}
            min={0}
            max={3}
          />
        </div>
      </div>

      {/* Draft Cost Settings */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Draft Cost Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingInput
            label="Undrafted Player Round"
            description="Default round for waiver/FA pickups"
            value={settings.undraftedRound}
            onChange={(v) => updateSetting("undraftedRound", v)}
            min={1}
            max={16}
          />
          <SettingInput
            label="Minimum Round"
            description="Earliest round a keeper can cost (usually 1)"
            value={settings.minimumRound}
            onChange={(v) => updateSetting("minimumRound", v)}
            min={1}
            max={5}
          />
        </div>
      </div>

      {/* Rules Summary */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Rules Summary</h2>
        <div className="space-y-3 text-gray-300">
          <p>
            <span className="text-purple-400">•</span> Each team can keep up to{" "}
            <strong>{settings.maxKeepers}</strong> players total
          </p>
          <p>
            <span className="text-purple-400">•</span> Up to{" "}
            <strong>{settings.maxFranchiseTags}</strong> can be franchise tags
            (cost Round 1, no year limit)
          </p>
          <p>
            <span className="text-purple-400">•</span> Up to{" "}
            <strong>{settings.maxRegularKeepers}</strong> can be regular keepers
            (max {settings.regularKeeperMaxYears} consecutive years)
          </p>
          <p>
            <span className="text-purple-400">•</span> Drafted players cost their
            draft round minus {settings.costReductionPerYear} (minimum Round{" "}
            {settings.minimumRound})
          </p>
          <p>
            <span className="text-purple-400">•</span> Waiver/FA pickups cost
            Round {settings.undraftedRound}
          </p>
          <p>
            <span className="text-purple-400">•</span> Traded players inherit
            their original acquisition cost
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function SettingInput({
  label,
  description,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white mb-1">
        {label}
      </label>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (!isNaN(v) && v >= min && v <= max) {
            onChange(v);
          }
        }}
        min={min}
        max={max}
        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
    </div>
  );
}
