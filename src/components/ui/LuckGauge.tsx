"use client";

import { cn } from "@/lib/design-tokens";

interface LuckGaugeProps {
  value: number;
  min?: number;
  max?: number;
  showLabels?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: {
    track: "h-2",
    marker: "w-3 h-3",
    labels: "text-[10px]",
    value: "text-xs",
  },
  md: {
    track: "h-3",
    marker: "w-4 h-4",
    labels: "text-xs",
    value: "text-sm",
  },
  lg: {
    track: "h-4",
    marker: "w-5 h-5",
    labels: "text-sm",
    value: "text-base",
  },
};

export function LuckGauge({
  value,
  min = -5,
  max = 5,
  showLabels = true,
  size = "md",
  className,
}: LuckGaugeProps) {
  const percent = ((value - min) / (max - min)) * 100;
  const isPositive = value >= 0;
  const styles = sizeStyles[size];

  return (
    <div className={cn("space-y-2", className)}>
      {/* Track */}
      <div
        className={cn(
          "relative bg-slate-800 rounded-full overflow-hidden",
          styles.track
        )}
      >
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600" />

        {/* Fill */}
        <div
          className={cn(
            "absolute top-0 h-full rounded-full transition-all duration-700",
            isPositive
              ? "bg-gradient-to-r from-blue-500 to-emerald-400"
              : "bg-gradient-to-l from-blue-500 to-rose-400"
          )}
          style={{
            left: isPositive ? "50%" : `${percent}%`,
            width: `${Math.abs(percent - 50)}%`,
          }}
        />

        {/* Marker */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg border-2 border-slate-900 transition-all duration-700",
            styles.marker
          )}
          style={{ left: `calc(${percent}% - ${size === "sm" ? 6 : size === "md" ? 8 : 10}px)` }}
        />
      </div>

      {/* Labels */}
      {showLabels && (
        <div className={cn("flex justify-between", styles.labels)}>
          <span className="text-slate-500">Unlucky</span>
          <span
            className={cn(
              "font-bold",
              isPositive ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {isPositive ? "+" : ""}
            {value.toFixed(1)}
          </span>
          <span className="text-slate-500">Lucky</span>
        </div>
      )}
    </div>
  );
}

interface LuckBarProps {
  value: number;
  label?: string;
  maxValue?: number;
  className?: string;
}

export function LuckBar({ value, label, maxValue = 5, className }: LuckBarProps) {
  const isPositive = value >= 0;
  const absValue = Math.abs(value);
  const widthPercent = (absValue / maxValue) * 50;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {label && <span className="text-sm text-slate-400 min-w-[100px]">{label}</span>}

      <div className="flex-1 flex items-center gap-1">
        {/* Negative side */}
        <div className="flex-1 flex justify-end">
          {!isPositive && (
            <div
              className="h-2 rounded-l-full bg-gradient-to-l from-blue-500 to-rose-400"
              style={{ width: `${widthPercent}%` }}
            />
          )}
        </div>

        {/* Center line */}
        <div className="w-px h-4 bg-slate-600" />

        {/* Positive side */}
        <div className="flex-1">
          {isPositive && (
            <div
              className="h-2 rounded-r-full bg-gradient-to-r from-blue-500 to-emerald-400"
              style={{ width: `${widthPercent}%` }}
            />
          )}
        </div>
      </div>

      <span
        className={cn(
          "text-sm font-medium min-w-[50px] text-right",
          isPositive ? "text-emerald-400" : "text-rose-400"
        )}
      >
        {isPositive ? "+" : ""}
        {value.toFixed(1)}
      </span>
    </div>
  );
}

interface LuckRankingItemProps {
  rank: number;
  name: string;
  value: number;
  isCurrentUser?: boolean;
  maxValue?: number;
  className?: string;
}

export function LuckRankingItem({
  rank,
  name,
  value,
  isCurrentUser = false,
  maxValue = 5,
  className,
}: LuckRankingItemProps) {
  const isPositive = value >= 0;
  const widthPercent = Math.min((Math.abs(value) / maxValue) * 100, 100);

  return (
    <div
      className={cn(
        "flex items-center gap-4 py-3 px-4 rounded-lg transition-colors",
        isCurrentUser ? "bg-blue-500/10 border border-blue-500/20" : "hover:bg-white/[0.02]",
        className
      )}
    >
      {/* Rank */}
      <span className="text-sm font-medium text-slate-500 w-6">{rank}.</span>

      {/* Name */}
      <span
        className={cn(
          "text-sm font-medium flex-1 truncate",
          isCurrentUser ? "text-blue-400" : "text-white"
        )}
      >
        {name}
        {isCurrentUser && (
          <span className="ml-2 text-xs text-blue-400/70">(You)</span>
        )}
      </span>

      {/* Bar */}
      <div className="w-32 flex items-center gap-2">
        <div
          className={cn(
            "h-2 rounded-full",
            isPositive
              ? "bg-gradient-to-r from-blue-500 to-emerald-400"
              : "bg-gradient-to-r from-rose-400 to-blue-500"
          )}
          style={{ width: `${widthPercent}%` }}
        />
      </div>

      {/* Value */}
      <span
        className={cn(
          "text-sm font-bold min-w-[50px] text-right",
          isPositive ? "text-emerald-400" : "text-rose-400"
        )}
      >
        {isPositive ? "+" : ""}
        {value.toFixed(1)}
      </span>
    </div>
  );
}
