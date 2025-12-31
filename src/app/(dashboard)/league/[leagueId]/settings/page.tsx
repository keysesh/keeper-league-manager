"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  Settings,
  Save,
  Shield,
  Users,
  Star,
  Clock,
  Hash,
  Lock,
  Unlock,
  AlertTriangle,
  Info,
  TrendingUp,
  Loader2,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";
import { BackLink } from "@/components/ui/BackLink";
import { useToast } from "@/components/ui/Toast";

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
});

interface SettingsData {
  leagueId: string;
  leagueName: string;
  season: number;
  status: string;
  isCommissioner: boolean;
  commissioner: {
    id: string;
    name: string;
  } | null;
  keeperSettings: {
    maxKeepers: number;
    maxFranchiseTags: number;
    maxRegularKeepers: number;
    regularKeeperMaxYears: number;
    undraftedRound: number;
    minimumRound: number;
    costReductionPerYear: number;
  };
  draftSettings: {
    draftRounds: number;
    totalRosters: number;
  };
}

export default function SettingsPage() {
  const params = useParams();
  const leagueId = params.leagueId as string;
  const { success, error: showError } = useToast();

  const { data, error, isLoading, mutate } = useSWR<SettingsData>(
    `/api/leagues/${leagueId}/settings`,
    fetcher
  );

  const [formData, setFormData] = useState({
    maxKeepers: 7,
    maxFranchiseTags: 2,
    maxRegularKeepers: 5,
    regularKeeperMaxYears: 2,
    undraftedRound: 8,
    minimumRound: 1,
    costReductionPerYear: 1,
  });

  const [saving, setSaving] = useState(false);
  const [lockingKeepers, setLockingKeepers] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data?.keeperSettings) {
      setFormData(data.keeperSettings);
    }
  }, [data]);

  useEffect(() => {
    if (data?.keeperSettings) {
      const changed = Object.keys(formData).some(
        (key) => formData[key as keyof typeof formData] !== data.keeperSettings[key as keyof typeof data.keeperSettings]
      );
      setHasChanges(changed);
    }
  }, [formData, data]);

  const handleChange = (field: keyof typeof formData, value: number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!data?.isCommissioner) return;

    // Validate
    if (formData.maxFranchiseTags + formData.maxRegularKeepers > formData.maxKeepers) {
      showError("Franchise tags + regular keepers cannot exceed max keepers");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keeperSettings: formData }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      mutate();
      success("Settings saved successfully");
      setHasChanges(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLockKeepers = async (lock: boolean) => {
    if (!data?.isCommissioner) return;

    setLockingKeepers(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: lock ? "lock" : "unlock" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update keepers");
      }

      const result = await res.json();
      success(result.message);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to update keepers");
    } finally {
      setLockingKeepers(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="text-red-400 font-medium">Failed to load settings</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <BackLink href={`/league/${leagueId}`} label="Back to League" />
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-500/20 to-gray-600/10 ring-1 ring-gray-500/20 flex items-center justify-center">
              <Settings className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">League Settings</h1>
              <p className="text-gray-500 mt-0.5">{data.leagueName} - {data.season} Season</p>
            </div>
          </div>
        </div>

        {data.isCommissioner && hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>

      {/* Commissioner Info */}
      <div className="bg-gradient-to-b from-gray-800/40 to-gray-800/20 rounded-2xl p-5 border border-gray-700/40">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/20">
            <Shield size={20} className="text-purple-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Commissioner</p>
            <p className="text-white font-medium">{data.commissioner?.name || "Not assigned"}</p>
          </div>
          {data.isCommissioner && (
            <span className="ml-auto px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-lg">
              You
            </span>
          )}
        </div>
        {!data.isCommissioner && (
          <div className="mt-4 flex items-center gap-2 text-amber-400 text-sm">
            <Info size={16} />
            <span>Only the commissioner can modify settings</span>
          </div>
        )}
      </div>

      {/* Keeper Settings */}
      <div className="bg-gradient-to-b from-gray-800/40 to-gray-800/20 rounded-2xl border border-gray-700/40 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700/40">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Star size={20} className="text-amber-400" />
            Keeper Rules
          </h2>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingField
            label="Maximum Keepers"
            description="Total keepers allowed per team"
            icon={<Users size={18} />}
            value={formData.maxKeepers}
            onChange={(v) => handleChange("maxKeepers", v)}
            min={1}
            max={20}
            disabled={!data.isCommissioner}
          />

          <SettingField
            label="Franchise Tags"
            description="Max franchise tags per team"
            icon={<Star size={18} />}
            value={formData.maxFranchiseTags}
            onChange={(v) => handleChange("maxFranchiseTags", v)}
            min={0}
            max={5}
            disabled={!data.isCommissioner}
          />

          <SettingField
            label="Regular Keepers"
            description="Max regular keepers per team"
            icon={<Users size={18} />}
            value={formData.maxRegularKeepers}
            onChange={(v) => handleChange("maxRegularKeepers", v)}
            min={0}
            max={20}
            disabled={!data.isCommissioner}
          />

          <SettingField
            label="Max Years"
            description="Years a player can be kept (regular)"
            icon={<Clock size={18} />}
            value={formData.regularKeeperMaxYears}
            onChange={(v) => handleChange("regularKeeperMaxYears", v)}
            min={1}
            max={10}
            disabled={!data.isCommissioner}
          />

          <SettingField
            label="Undrafted Round"
            description="Cost for undrafted players"
            icon={<Hash size={18} />}
            value={formData.undraftedRound}
            onChange={(v) => handleChange("undraftedRound", v)}
            min={1}
            max={20}
            suffix="Round"
            disabled={!data.isCommissioner}
          />

          <SettingField
            label="Minimum Round"
            description="Lowest round cost possible"
            icon={<Hash size={18} />}
            value={formData.minimumRound}
            onChange={(v) => handleChange("minimumRound", v)}
            min={1}
            max={5}
            suffix="Round"
            disabled={!data.isCommissioner}
          />

          <SettingField
            label="Cost Reduction"
            description="Rounds improved per year kept"
            icon={<TrendingUp size={18} />}
            value={formData.costReductionPerYear}
            onChange={(v) => handleChange("costReductionPerYear", v)}
            min={0}
            max={3}
            suffix="per year"
            disabled={!data.isCommissioner}
          />
        </div>

        {/* Validation Warning */}
        {formData.maxFranchiseTags + formData.maxRegularKeepers > formData.maxKeepers && (
          <div className="mx-6 mb-6 flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <AlertTriangle size={16} />
            <span>Franchise tags ({formData.maxFranchiseTags}) + regular keepers ({formData.maxRegularKeepers}) cannot exceed max keepers ({formData.maxKeepers})</span>
          </div>
        )}
      </div>

      {/* Draft Info */}
      <div className="bg-gradient-to-b from-gray-800/40 to-gray-800/20 rounded-2xl border border-gray-700/40 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700/40">
          <h2 className="text-lg font-semibold text-white">Draft Settings</h2>
          <p className="text-gray-500 text-sm mt-1">Synced from Sleeper</p>
        </div>

        <div className="p-6 grid grid-cols-2 gap-6">
          <div>
            <p className="text-gray-400 text-sm">Draft Rounds</p>
            <p className="text-white text-2xl font-bold mt-1">{data.draftSettings.draftRounds}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Total Teams</p>
            <p className="text-white text-2xl font-bold mt-1">{data.draftSettings.totalRosters}</p>
          </div>
        </div>
      </div>

      {/* Rules Summary */}
      <div className="bg-gradient-to-b from-gray-800/40 to-gray-800/20 rounded-2xl border border-gray-700/40 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700/40">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Info size={20} className="text-blue-400" />
            Rules Summary
          </h2>
        </div>

        <div className="p-6 space-y-3">
          <RuleSummaryItem
            icon={<Users size={16} className="text-gray-400" />}
            text={`Each team can keep up to ${formData.maxKeepers} players total`}
          />
          <RuleSummaryItem
            icon={<Star size={16} className="text-amber-400" />}
            text={`Up to ${formData.maxFranchiseTags} can be franchise tags (Round 1, no year limit)`}
          />
          <RuleSummaryItem
            icon={<Clock size={16} className="text-purple-400" />}
            text={`Regular keepers can be kept max ${formData.regularKeeperMaxYears} consecutive years`}
          />
          <RuleSummaryItem
            icon={<TrendingUp size={16} className="text-emerald-400" />}
            text={`Keeper cost improves ${formData.costReductionPerYear} round per year (min Round ${formData.minimumRound})`}
          />
          <RuleSummaryItem
            icon={<Hash size={16} className="text-blue-400" />}
            text={`Waiver/FA pickups cost Round ${formData.undraftedRound}`}
          />
        </div>
      </div>

      {/* Commissioner Actions */}
      {data.isCommissioner && (
        <div className="bg-gradient-to-b from-gray-800/40 to-gray-800/20 rounded-2xl border border-gray-700/40 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700/40">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Shield size={20} className="text-purple-400" />
              Commissioner Actions
            </h2>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-900/50 rounded-xl border border-gray-700/30">
              <div>
                <p className="text-white font-medium">Lock All Keepers</p>
                <p className="text-gray-500 text-sm mt-1">Prevent changes to keeper selections league-wide</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleLockKeepers(true)}
                  disabled={lockingKeepers}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Lock size={16} />
                  Lock
                </button>
                <button
                  onClick={() => handleLockKeepers(false)}
                  disabled={lockingKeepers}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Unlock size={16} />
                  Unlock
                </button>
              </div>
            </div>

            {/* Link to advanced commissioner tools */}
            <Link
              href={`/league/${leagueId}/commissioner`}
              className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl border border-gray-700/30 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group"
            >
              <div>
                <p className="text-white font-medium group-hover:text-purple-400 transition-colors">Advanced Tools</p>
                <p className="text-gray-500 text-sm mt-1">Manage keepers across all teams, view activity logs</p>
              </div>
              <ChevronRight size={20} className="text-gray-500 group-hover:text-purple-400 transition-colors" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingField({
  label,
  description,
  icon,
  value,
  onChange,
  min,
  max,
  suffix,
  disabled,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`space-y-2 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="text-gray-400">{icon}</span>
        <label className="text-white font-medium">{label}</label>
      </div>
      <p className="text-gray-500 text-xs">{description}</p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
          min={min}
          max={max}
          disabled={disabled}
          className="w-24 px-3 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white text-center font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 disabled:cursor-not-allowed"
        />
        {suffix && <span className="text-gray-500 text-sm">{suffix}</span>}
      </div>
    </div>
  );
}

function RuleSummaryItem({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-900/30">
      <span className="mt-0.5">{icon}</span>
      <p className="text-gray-300 text-sm leading-relaxed">{text}</p>
    </div>
  );
}
