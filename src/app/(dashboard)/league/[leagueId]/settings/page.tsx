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
    undraftedRound: 10,
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
      <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-500 border-t-transparent" />
          <p className="text-gray-500 font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <p className="text-red-400 font-medium">League not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <Link
          href={`/league/${leagueId}`}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-purple-400 text-sm mb-4 transition-colors"
        >
          <span>&larr;</span>
          <span>Back to League</span>
        </Link>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">League Settings</h1>
        <p className="text-gray-500 mt-2 text-lg">
          {league.name} &bull; <span className="text-purple-400">{league.season}</span> Season
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <span className="text-red-400 text-lg">!</span>
            </div>
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <span className="text-green-400 text-lg">&#10003;</span>
            </div>
            <p className="text-green-400 font-medium">{success}</p>
          </div>
        </div>
      )}

      {/* Keeper Limits */}
      <div className="card-premium rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <span className="w-1 h-5 bg-purple-500 rounded-full"></span>
          Keeper Limits
        </h2>
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
      <div className="card-premium rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
          Keeper Rules
        </h2>
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
      <div className="card-premium rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <span className="w-1 h-5 bg-green-500 rounded-full"></span>
          Draft Cost Settings
        </h2>
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
      <div className="card-premium rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <span className="w-1 h-5 bg-amber-500 rounded-full"></span>
          Rules Summary
        </h2>
        <div className="space-y-4">
          <RuleSummaryItem
            icon="&#128101;"
            text={`Each team can keep up to ${settings.maxKeepers} players total`}
          />
          <RuleSummaryItem
            icon="&#11088;"
            text={`Up to ${settings.maxFranchiseTags} can be franchise tags (cost Round 1, no year limit)`}
            highlight="franchise"
          />
          <RuleSummaryItem
            icon="&#128100;"
            text={`Up to ${settings.maxRegularKeepers} can be regular keepers (max ${settings.regularKeeperMaxYears} consecutive years)`}
            highlight="keeper"
          />
          <RuleSummaryItem
            icon="&#128200;"
            text={`Drafted players cost their draft round minus ${settings.costReductionPerYear} per year (minimum Round ${settings.minimumRound})`}
          />
          <RuleSummaryItem
            icon="&#128203;"
            text={`Waiver/FA pickups cost Round ${settings.undraftedRound}`}
          />
          <RuleSummaryItem
            icon="&#8644;"
            text="Traded players inherit their original acquisition cost"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-lg transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/40 hover:scale-[1.02] flex items-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </>
          ) : (
            "Save Settings"
          )}
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
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-white">
        {label}
      </label>
      <p className="text-xs text-gray-500">{description}</p>
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
        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
      />
    </div>
  );
}

function RuleSummaryItem({
  icon,
  text,
  highlight,
}: {
  icon: string;
  text: string;
  highlight?: "franchise" | "keeper";
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-800/30">
      <span className="text-xl">{icon}</span>
      <p className="text-gray-300 leading-relaxed">
        {highlight === "franchise" ? (
          <span>
            {text.split("franchise tags")[0]}
            <span className="badge-franchise mx-1">FT</span>
            {text.split("franchise tags")[1]}
          </span>
        ) : highlight === "keeper" ? (
          <span>
            {text.split("regular keepers")[0]}
            <span className="badge-keeper mx-1">K</span>
            {text.split("regular keepers")[1]}
          </span>
        ) : (
          text
        )}
      </p>
    </div>
  );
}
