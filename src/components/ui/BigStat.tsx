"use client";

import { cn } from "@/lib/design-tokens";
import { ReactNode } from "react";

interface BigStatProps {
  value: string | number;
  label: string;
  trend?: number;
  trendLabel?: string;
  color?: "default" | "primary" | "positive" | "negative" | "warning";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const colorStyles = {
  default: "text-white",
  primary: "text-blue-400",
  positive: "text-emerald-400",
  negative: "text-red-400",
  warning: "text-amber-400",
};

const sizeStyles = {
  sm: {
    value: "text-2xl",
    label: "text-xs",
    trend: "text-[10px]",
  },
  md: {
    value: "text-3xl",
    label: "text-sm",
    trend: "text-xs",
  },
  lg: {
    value: "text-4xl",
    label: "text-sm",
    trend: "text-xs",
  },
};

export function BigStat({
  value,
  label,
  trend,
  trendLabel,
  color = "default",
  size = "md",
  className,
}: BigStatProps) {
  const styles = sizeStyles[size];

  return (
    <div className={cn("text-center", className)}>
      <div className={cn(styles.value, "font-bold tracking-tight", colorStyles[color])}>
        {value}
      </div>
      <div className={cn(styles.label, "text-slate-400 mt-1")}>{label}</div>
      {trend !== undefined && (
        <div
          className={cn(
            styles.trend,
            "font-medium mt-2",
            trend > 0 ? "text-emerald-400" : trend < 0 ? "text-red-400" : "text-slate-500"
          )}
        >
          {trend > 0 ? "+" : ""}
          {trend}
          {trendLabel && ` ${trendLabel}`}
        </div>
      )}
    </div>
  );
}

interface StatRowProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatRow({ label, value, subValue, trend, className }: StatRowProps) {
  return (
    <div className={cn("flex items-center justify-between py-2", className)}>
      <span className="text-sm text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white">{value}</span>
        {subValue && <span className="text-xs text-slate-500">({subValue})</span>}
        {trend && (
          <span
            className={cn(
              "text-xs",
              trend === "up" && "text-emerald-400",
              trend === "down" && "text-red-400",
              trend === "neutral" && "text-slate-500"
            )}
          >
            {trend === "up" && ""}
            {trend === "down" && ""}
            {trend === "neutral" && ""}
          </span>
        )}
      </div>
    </div>
  );
}

interface StatGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatGrid({ children, columns = 4, className }: StatGridProps) {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>{children}</div>
  );
}

interface CompactStatProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  className?: string;
}

export function CompactStat({ label, value, icon, className }: CompactStatProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {icon && (
        <div className="w-8 h-8 rounded-md flex items-center justify-center bg-white/[0.05] text-slate-400">
          {icon}
        </div>
      )}
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}
