"use client";

import { cn } from "@/lib/design-tokens";
import {
  Trophy,
  Medal,
  TrendingUp,
  Target,
  ArrowLeftRight,
  Zap,
  Crown,
  type LucideIcon,
} from "lucide-react";

type AwardVariant = "gold" | "silver" | "bronze" | "blue" | "emerald";

interface AwardBadgeProps {
  icon: LucideIcon;
  label: string;
  value?: string | number;
  variant: AwardVariant;
}

const variantStyles: Record<AwardVariant, {
  bg: string;
  border: string;
  icon: string;
  text: string;
  glow: string;
}> = {
  gold: {
    bg: "bg-gradient-to-br from-amber-500/20 to-amber-600/10",
    border: "border-amber-500/30",
    icon: "text-amber-400",
    text: "text-amber-300",
    glow: "shadow-amber-500/10",
  },
  silver: {
    bg: "bg-gradient-to-br from-slate-400/20 to-slate-500/10",
    border: "border-slate-400/30",
    icon: "text-slate-300",
    text: "text-slate-200",
    glow: "shadow-slate-400/10",
  },
  bronze: {
    bg: "bg-gradient-to-br from-orange-600/20 to-orange-700/10",
    border: "border-orange-500/30",
    icon: "text-orange-400",
    text: "text-orange-300",
    glow: "shadow-orange-500/10",
  },
  blue: {
    bg: "bg-gradient-to-br from-blue-500/20 to-blue-600/10",
    border: "border-blue-500/30",
    icon: "text-blue-400",
    text: "text-blue-300",
    glow: "shadow-blue-500/10",
  },
  emerald: {
    bg: "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10",
    border: "border-emerald-500/30",
    icon: "text-emerald-400",
    text: "text-emerald-300",
    glow: "shadow-emerald-500/10",
  },
};

export function AwardBadge({ icon: Icon, label, value, variant }: AwardBadgeProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        "border shadow-lg transition-all hover:scale-[1.02]",
        styles.bg,
        styles.border,
        styles.glow
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          "bg-white/[0.05]"
        )}
      >
        <Icon className={cn("w-4 h-4", styles.icon)} strokeWidth={2} />
      </div>
      <div>
        <p className={cn("text-xs font-semibold", styles.text)}>{label}</p>
        {value !== undefined && (
          <p className="text-[10px] text-slate-500">{value}</p>
        )}
      </div>
    </div>
  );
}

// Award types configuration for teams
export interface TeamAward {
  type: "champion" | "runner_up" | "points_leader" | "best_record" | "trade_master" | "waiver_hawk" | "dynasty";
  count?: number;
  season?: number;
}

const awardConfig: Record<TeamAward["type"], {
  icon: LucideIcon;
  label: string;
  variant: AwardVariant;
  getValue: (count?: number, season?: number) => string | undefined;
}> = {
  champion: {
    icon: Trophy,
    label: "Champion",
    variant: "gold",
    getValue: (count) => count && count > 1 ? `${count}x` : undefined,
  },
  runner_up: {
    icon: Medal,
    label: "Runner-Up",
    variant: "silver",
    getValue: (count) => count && count > 1 ? `${count}x` : undefined,
  },
  points_leader: {
    icon: TrendingUp,
    label: "Points Leader",
    variant: "blue",
    getValue: (_count, season) => season ? `${season}` : undefined,
  },
  best_record: {
    icon: Target,
    label: "Best Record",
    variant: "emerald",
    getValue: (_count, season) => season ? `${season}` : undefined,
  },
  trade_master: {
    icon: ArrowLeftRight,
    label: "Trade Master",
    variant: "bronze",
    getValue: () => undefined,
  },
  waiver_hawk: {
    icon: Zap,
    label: "Waiver Hawk",
    variant: "bronze",
    getValue: () => undefined,
  },
  dynasty: {
    icon: Crown,
    label: "Dynasty",
    variant: "gold",
    getValue: (count) => count && count >= 2 ? `${count}x Champ` : undefined,
  },
};

export function TeamAwardBadge({ type, count, season }: TeamAward) {
  const config = awardConfig[type];
  const value = config.getValue(count, season);

  return (
    <AwardBadge
      icon={config.icon}
      label={config.label}
      value={value}
      variant={config.variant}
    />
  );
}

// Awards section component
interface AwardsSectionProps {
  awards: TeamAward[];
  className?: string;
}

export function AwardsSection({ awards, className }: AwardsSectionProps) {
  if (awards.length === 0) return null;

  return (
    <section className={cn("mt-4", className)}>
      <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Achievements
      </h3>
      <div className="flex flex-wrap gap-2">
        {awards.map((award, index) => (
          <TeamAwardBadge key={`${award.type}-${index}`} {...award} />
        ))}
      </div>
    </section>
  );
}

// Export icons for custom usage
export { Trophy, Medal, TrendingUp, Target, ArrowLeftRight, Zap, Crown };
