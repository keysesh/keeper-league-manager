"use client";

import { ReactNode } from "react";
import { RefreshCw, ChevronRight } from "lucide-react";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: {
    label: string;
    color?: "purple" | "emerald" | "amber" | "blue" | "gray";
  };
  teamCount?: number;
  actions?: ReactNode;
  syncing?: boolean;
  onSync?: () => void;
  primaryAction?: {
    label: string;
    href: string;
  };
}

const badgeColors = {
  purple: "bg-violet-500/20 text-violet-400 ring-violet-500/30",
  emerald: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
  amber: "bg-amber-500/20 text-amber-400 ring-amber-500/30",
  blue: "bg-blue-500/20 text-blue-400 ring-blue-500/30",
  gray: "bg-zinc-500/20 text-zinc-400 ring-zinc-500/30",
};

export function PageHeader({
  title,
  subtitle,
  badge,
  teamCount,
  actions,
  syncing,
  onSync,
  primaryAction,
}: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {/* Title row */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-white truncate">
            {title}
          </h1>
          {badge && (
            <span className={`
              px-2.5 py-1 rounded-lg text-xs font-bold ring-1
              ${badgeColors[badge.color || "purple"]}
            `}>
              {badge.label}
            </span>
          )}
        </div>

        {/* Subtitle row */}
        {(subtitle || teamCount) && (
          <div className="flex items-center gap-2 mt-1.5">
            {teamCount && (
              <span className="text-sm text-zinc-500">
                {teamCount} teams
              </span>
            )}
            {subtitle && teamCount && (
              <span className="text-zinc-600">•</span>
            )}
            {subtitle && (
              <span className="text-sm text-zinc-500">{subtitle}</span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {onSync && (
          <button
            onClick={onSync}
            disabled={syncing}
            className={`
              group flex items-center gap-2 px-3 py-2 rounded-xl
              bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-sm
              border border-white/[0.06] hover:border-white/[0.1]
              text-sm font-medium text-zinc-300 hover:text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
            `}
          >
            <RefreshCw
              size={14}
              className={`text-zinc-400 group-hover:text-white transition-colors ${
                syncing ? "animate-spin" : ""
              }`}
            />
            <span className="hidden sm:inline">{syncing ? "Syncing..." : "Sync"}</span>
          </button>
        )}

        {primaryAction && (
          <Link
            href={primaryAction.href}
            className="
              group flex items-center gap-1.5 px-4 py-2 rounded-xl
              bg-gradient-to-r from-violet-600 to-purple-600
              hover:from-violet-500 hover:to-purple-500
              text-sm font-semibold text-white
              shadow-lg shadow-violet-500/20
              transition-all duration-200
              hover:shadow-violet-500/30
            "
          >
            {primaryAction.label}
            <ChevronRight
              size={14}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </Link>
        )}

        {actions}
      </div>
    </div>
  );
}
