"use client";

import { Trophy, Medal, Crown } from "lucide-react";
import { cn } from "@/lib/design-tokens";

interface Championship {
  season: number;
}

interface TeamTrophyCaseProps {
  championships: Championship[];
  runnerUps: Championship[];
  variant?: "full" | "compact" | "horizontal";
  className?: string;
}

/**
 * Trophy Case component for displaying team championships and runner-up finishes
 * Supports multiple variants:
 * - full: Original with header (default)
 * - compact: Smaller for bento cards
 * - horizontal: Single row for header integration
 */
export function TeamTrophyCase({
  championships,
  runnerUps,
  variant = "full",
  className,
}: TeamTrophyCaseProps) {
  if (championships.length === 0 && runnerUps.length === 0) return null;

  const isDynasty = championships.length >= 2;

  // Horizontal variant - just the trophies in a row (no card wrapper)
  if (variant === "horizontal") {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        {championships.map((champ) => (
          <div
            key={`champ-${champ.season}`}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/30"
            title={`${champ.season} Champion`}
          >
            <Trophy className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400">{champ.season}</span>
          </div>
        ))}
        {runnerUps.map((ru) => (
          <div
            key={`ru-${ru.season}`}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-400/15 border border-slate-400/30"
            title={`${ru.season} Runner-Up`}
          >
            <Medal className="w-3 h-3 text-slate-300" />
            <span className="text-[10px] font-medium text-slate-400">{ru.season}</span>
          </div>
        ))}
      </div>
    );
  }

  // Compact variant - smaller card for bento grid
  if (variant === "compact") {
    return (
      <div className={cn("bg-[#0d1420] border border-white/[0.06] rounded-xl p-4", className)}>
        <div className="flex items-center gap-2 mb-3">
          <div className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center",
            isDynasty
              ? "bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30"
              : "bg-amber-500/15 border border-amber-500/25"
          )}>
            {isDynasty ? (
              <Crown className="w-3 h-3 text-amber-400" />
            ) : (
              <Trophy className="w-3 h-3 text-amber-400" />
            )}
          </div>
          <h3 className="text-sm font-semibold text-white">Trophy Case</h3>
          {isDynasty && (
            <span className="px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 text-amber-400 text-[9px] font-bold uppercase">
              Dynasty
            </span>
          )}
        </div>

        {/* Compact trophy display */}
        <div className="flex flex-wrap gap-1.5">
          {championships.map((champ) => (
            <div
              key={`champ-${champ.season}`}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gradient-to-br from-amber-500/15 to-amber-600/10 border border-amber-500/25 transition-transform hover:scale-[1.02]"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold text-amber-300">{champ.season}</span>
            </div>
          ))}
          {runnerUps.map((ru) => (
            <div
              key={`ru-${ru.season}`}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gradient-to-br from-slate-400/15 to-slate-500/10 border border-slate-400/25 transition-transform hover:scale-[1.02]"
            >
              <Medal className="w-3.5 h-3.5 text-slate-300" />
              <span className="text-[11px] font-medium text-slate-300">{ru.season}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Full variant (default)
  return (
    <div className={cn("bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden", className)}>
      <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={cn(
            "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center",
            isDynasty
              ? "bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30"
              : "bg-amber-500/15 border border-amber-500/25"
          )}>
            {isDynasty ? (
              <Crown className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
            )}
          </div>
          <h2 className="text-sm sm:text-base font-semibold text-white">
            {isDynasty ? "Dynasty Trophy Case" : "Trophy Case"}
          </h2>
          {isDynasty && (
            <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 text-amber-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Dynasty
            </span>
          )}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {/* Championships - Gold trophies */}
          {championships.map((champ) => (
            <div
              key={`champ-${champ.season}`}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
                "bg-gradient-to-br from-amber-500/20 to-amber-600/10",
                "border border-amber-500/30",
                "shadow-lg shadow-amber-500/10",
                "transition-transform hover:scale-[1.02]"
              )}
            >
              <div className="w-6 h-6 rounded-md bg-amber-500/20 flex items-center justify-center">
                <Trophy className="w-3 h-3 text-amber-400" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-amber-300">Champion</p>
                <p className="text-[9px] text-amber-400/70">{champ.season}</p>
              </div>
            </div>
          ))}

          {/* Runner-ups - Silver medals */}
          {runnerUps.map((ru) => (
            <div
              key={`ru-${ru.season}`}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
                "bg-gradient-to-br from-slate-400/20 to-slate-500/10",
                "border border-slate-400/30",
                "shadow-lg shadow-slate-400/10",
                "transition-transform hover:scale-[1.02]"
              )}
            >
              <div className="w-6 h-6 rounded-md bg-slate-400/20 flex items-center justify-center">
                <Medal className="w-3 h-3 text-slate-300" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-200">Runner-Up</p>
                <p className="text-[9px] text-slate-400">{ru.season}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
