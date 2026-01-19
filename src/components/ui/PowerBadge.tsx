"use client";

import { cn, getGradeGradient } from "@/lib/design-tokens";
import { ReactNode } from "react";

interface PowerBadgeProps {
  grade: string;
  score?: number;
  size?: "sm" | "md" | "lg";
  showScore?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: {
    badge: "w-10 h-10 rounded-lg text-base",
    score: "text-xs",
  },
  md: {
    badge: "w-14 h-14 rounded-xl text-xl",
    score: "text-sm",
  },
  lg: {
    badge: "w-18 h-18 rounded-2xl text-2xl",
    score: "text-base",
  },
};

export function PowerBadge({
  grade,
  score,
  size = "md",
  showScore = true,
  className,
}: PowerBadgeProps) {
  const styles = sizeStyles[size];
  const gradientClasses = getGradeGradient(grade);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br font-bold text-white shadow-lg",
          styles.badge,
          gradientClasses
        )}
      >
        {grade}
      </div>
      {showScore && score !== undefined && (
        <div className={cn("text-slate-400", styles.score)}>{score} pts</div>
      )}
    </div>
  );
}

interface PowerRankBadgeProps {
  rank: number;
  previousRank?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PowerRankBadge({
  rank,
  previousRank,
  size = "md",
  className,
}: PowerRankBadgeProps) {
  const change = previousRank ? previousRank - rank : 0;
  const sizeClasses = {
    sm: "text-lg w-8 h-8",
    md: "text-xl w-10 h-10",
    lg: "text-2xl w-12 h-12",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 font-bold text-white",
          sizeClasses[size]
        )}
      >
        #{rank}
      </div>
      {change !== 0 && (
        <span
          className={cn(
            "text-xs font-medium",
            change > 0 ? "text-emerald-400" : "text-red-400"
          )}
        >
          {change > 0 ? "" : ""}
          {Math.abs(change)}
        </span>
      )}
    </div>
  );
}

interface PowerProgressBarProps {
  score: number;
  maxScore?: number;
  grade: string;
  showLabel?: boolean;
  className?: string;
}

export function PowerProgressBar({
  score,
  maxScore = 100,
  grade,
  showLabel = true,
  className,
}: PowerProgressBarProps) {
  const percent = Math.min((score / maxScore) * 100, 100);
  const gradientClasses = getGradeGradient(grade);

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <div className="flex justify-between text-xs text-slate-400">
          <span>Power Score</span>
          <span>{score} / {maxScore}</span>
        </div>
      )}
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", gradientClasses)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

interface TrendBadgeProps {
  direction: "up" | "down" | "neutral";
  value?: number | string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function TrendBadge({
  direction,
  value,
  label,
  size = "md",
  className,
}: TrendBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
  };

  const directionStyles = {
    up: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    down: "bg-red-500/15 text-red-400 border-red-500/20",
    neutral: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  };

  const arrows = {
    up: "",
    down: "",
    neutral: "",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-medium",
        sizeClasses[size],
        directionStyles[direction],
        className
      )}
    >
      <span>{arrows[direction]}</span>
      {value !== undefined && <span>{value}</span>}
      {label && <span>{label}</span>}
    </span>
  );
}

interface TeamCardHeaderProps {
  rank: number;
  name: string;
  grade: string;
  score: number;
  record?: string;
  isCurrentUser?: boolean;
  previousRank?: number;
  children?: ReactNode;
  className?: string;
}

export function TeamCardHeader({
  rank,
  name,
  grade,
  score,
  record,
  isCurrentUser = false,
  previousRank,
  children,
  className,
}: TeamCardHeaderProps) {
  const change = previousRank ? previousRank - rank : 0;

  return (
    <div
      className={cn(
        "p-4 rounded-xl border transition-colors",
        isCurrentUser
          ? "bg-blue-500/10 border-blue-500/20"
          : "bg-[#0d1420] border-white/[0.06] hover:bg-[#131a28] hover:border-white/[0.1]",
        className
      )}
    >
      <div className="flex items-center gap-4">
        {/* Rank */}
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white">#{rank}</span>
          {change !== 0 && (
            <span
              className={cn(
                "text-xs font-medium",
                change > 0 ? "text-emerald-400" : "text-red-400"
              )}
            >
              {change > 0 ? "" : ""}{Math.abs(change)}
            </span>
          )}
        </div>

        {/* Name and record */}
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              "font-semibold truncate",
              isCurrentUser ? "text-blue-400" : "text-white"
            )}
          >
            {name}
            {isCurrentUser && (
              <span className="ml-2 text-xs text-blue-400/70 font-normal">(You)</span>
            )}
          </h3>
          {record && <p className="text-sm text-slate-500">{record}</p>}
        </div>

        {/* Grade badge */}
        <PowerBadge grade={grade} score={score} />
      </div>

      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
