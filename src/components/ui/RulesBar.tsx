"use client";

import { Info, Crown, Users, Calendar, Hash } from "lucide-react";

interface KeeperSettings {
  maxKeepers: number;
  maxFranchiseTags: number;
  maxRegularKeepers: number;
  regularKeeperMaxYears: number;
  undraftedRound: number;
}

interface RulesBarProps {
  settings: KeeperSettings;
}

export function RulesBar({ settings }: RulesBarProps) {
  const rules = [
    {
      icon: Users,
      label: "Max Keepers",
      value: settings.maxKeepers,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      icon: Crown,
      label: "Franchise Tags",
      value: settings.maxFranchiseTags,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      icon: Users,
      label: "Regular",
      value: settings.maxRegularKeepers,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      icon: Calendar,
      label: "Year Limit",
      value: `${settings.regularKeeperMaxYears}yr`,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      icon: Hash,
      label: "Undrafted Rd",
      value: `R${settings.undraftedRound}`,
      color: "text-zinc-400",
      bg: "bg-zinc-500/10",
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#13111a]/80 via-[#0c0a0f]/60 to-[#13111a]/80 border border-white/[0.06] backdrop-blur-sm">
      {/* Subtle top accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

      <div className="flex items-center gap-2 px-4 py-2.5">
        {/* Label */}
        <div className="flex items-center gap-2 pr-3 border-r border-white/[0.06]">
          <Info className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Rules</span>
        </div>

        {/* Rules chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {rules.map((rule, index) => (
            <div
              key={index}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                ${rule.bg} border border-white/[0.04]
                transition-all duration-200 hover:border-white/[0.08]
              `}
            >
              <rule.icon className={`w-3 h-3 ${rule.color}`} />
              <span className="text-[11px] text-zinc-400">{rule.label}</span>
              <span className={`text-xs font-bold ${rule.color}`}>{rule.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
