"use client";

import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type StatVariant = "record" | "points" | "keepers" | "synced" | "default";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  variant?: StatVariant;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  glowColor?: string;
}

const variantStyles: Record<StatVariant, {
  gradient: string;
  glow: string;
  accent: string;
  iconBg: string;
  hoverGlow: string;
}> = {
  record: {
    gradient: "from-zinc-800/60 via-zinc-900/40 to-[#13111a]",
    glow: "shadow-[0_0_30px_-5px_rgba(113,113,122,0.2)]",
    accent: "text-zinc-100",
    iconBg: "bg-zinc-600/20",
    hoverGlow: "bg-zinc-500/10",
  },
  points: {
    gradient: "from-emerald-900/30 via-emerald-950/20 to-[#13111a]",
    glow: "shadow-[0_0_30px_-5px_rgba(16,185,129,0.2)]",
    accent: "text-emerald-400",
    iconBg: "bg-emerald-500/15",
    hoverGlow: "bg-emerald-500/10",
  },
  keepers: {
    gradient: "from-amber-900/30 via-amber-950/20 to-[#13111a]",
    glow: "shadow-[0_0_30px_-5px_rgba(245,158,11,0.25)]",
    accent: "text-amber-400",
    iconBg: "bg-amber-500/15",
    hoverGlow: "bg-amber-500/10",
  },
  synced: {
    gradient: "from-purple-900/25 via-purple-950/15 to-[#13111a]",
    glow: "shadow-[0_0_30px_-5px_rgba(168,85,247,0.2)]",
    accent: "text-purple-400",
    iconBg: "bg-purple-500/15",
    hoverGlow: "bg-purple-500/10",
  },
  default: {
    gradient: "from-zinc-800/50 via-zinc-900/30 to-[#13111a]",
    glow: "shadow-[0_0_20px_-5px_rgba(113,113,122,0.15)]",
    accent: "text-zinc-300",
    iconBg: "bg-zinc-600/20",
    hoverGlow: "bg-zinc-500/10",
  },
};

export function StatCard({
  label,
  value,
  subValue,
  variant = "default",
  icon,
  trend,
  trendValue,
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl p-4
        bg-gradient-to-br ${styles.gradient}
        border border-white/[0.06]
        backdrop-blur-xl
        ${styles.glow}
        hover:border-white/[0.12]
        hover:scale-[1.02]
        transition-all duration-300 ease-out
        group
      `}
    >
      {/* Glass overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/[0.02] pointer-events-none" />

      {/* Accent line at top */}
      <div className={`absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent ${styles.accent.replace('text-', 'via-')}/20 to-transparent`} />

      {/* Content */}
      <div className="relative z-10">
        {/* Header with icon */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            {label}
          </span>
          {icon && (
            <div className={`p-1.5 rounded-lg ${styles.iconBg} backdrop-blur-sm`}>
              {icon}
            </div>
          )}
        </div>

        {/* Main value */}
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-3xl font-bold tracking-tight ${styles.accent}`}>
              {value}
            </p>
            {subValue && (
              <p className="text-xs text-zinc-500 mt-1">{subValue}</p>
            )}
          </div>

          {/* Trend indicator */}
          {trend && (
            <div className={`
              flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm
              ${trend === "up" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : ""}
              ${trend === "down" ? "bg-red-500/15 text-red-400 border border-red-500/20" : ""}
              ${trend === "neutral" ? "bg-zinc-500/15 text-zinc-400 border border-zinc-500/20" : ""}
            `}>
              {trend === "up" && <TrendingUp size={12} />}
              {trend === "down" && <TrendingDown size={12} />}
              {trend === "neutral" && <Minus size={12} />}
              {trendValue && <span>{trendValue}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Hover glow effect */}
      <div className={`
        absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100
        transition-opacity duration-500 -z-10 blur-xl
        ${styles.hoverGlow}
      `} />
    </div>
  );
}

// Preset stat cards for common use cases
export function RecordCard({ wins, losses, ties = 0 }: { wins: number; losses: number; ties?: number }) {
  const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
  const winPct = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(0) : "0";

  return (
    <StatCard
      label="Record"
      value={record}
      subValue={`${winPct}% win rate`}
      variant="record"
      icon={
        <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      }
    />
  );
}

export function PointsCard({ points, rank }: { points: number; rank?: number }) {
  return (
    <StatCard
      label="Points For"
      value={points.toLocaleString()}
      subValue={rank ? `#${rank} in league` : undefined}
      variant="points"
      icon={
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      }
    />
  );
}

export function KeepersCard({
  current,
  max,
  franchiseTags = 0
}: {
  current: number;
  max: number;
  franchiseTags?: number;
}) {
  const isFull = current >= max;

  return (
    <StatCard
      label="Keepers"
      value={`${current}/${max}`}
      subValue={franchiseTags > 0 ? `${franchiseTags} franchise tag${franchiseTags > 1 ? "s" : ""}` : isFull ? "Roster complete" : `${max - current} slots open`}
      variant="keepers"
      icon={
        <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      }
    />
  );
}

export function SyncedCard({ date, isStale = false }: { date: Date | string | null; isStale?: boolean }) {
  const syncDate = date ? new Date(date) : null;
  const formatted = syncDate
    ? syncDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "Never";

  const timeAgo = syncDate
    ? getTimeAgo(syncDate)
    : null;

  return (
    <StatCard
      label="Last Sync"
      value={formatted}
      subValue={timeAgo || "Sync to update"}
      variant="synced"
      trend={isStale ? "down" : syncDate ? "up" : "neutral"}
      trendValue={isStale ? "Stale" : syncDate ? "Fresh" : ""}
      icon={
        <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      }
    />
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}
