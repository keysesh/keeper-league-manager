"use client";

import { Trophy, Medal, Crown } from "lucide-react";
import { cn } from "@/lib/design-tokens";

interface Championship {
  season: number;
}

interface TeamTrophyCaseProps {
  championships: Championship[];
  runnerUps: Championship[];
}

/**
 * Trophy Case component for displaying team championships and runner-up finishes
 * Only renders if team has at least one achievement
 */
export function TeamTrophyCase({ championships, runnerUps }: TeamTrophyCaseProps) {
  if (championships.length === 0 && runnerUps.length === 0) return null;

  const isDynasty = championships.length >= 2;

  return (
    <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06]">
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
          <h2 className="text-base sm:text-lg font-semibold text-white">
            {isDynasty ? "Dynasty Trophy Case" : "Trophy Case"}
          </h2>
          {isDynasty && (
            <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 text-amber-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Dynasty
            </span>
          )}
        </div>
      </div>
      <div className="p-3 sm:p-5">
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {/* Championships - Gold trophies */}
          {championships.map((champ) => (
            <div
              key={`champ-${champ.season}`}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg",
                "bg-gradient-to-br from-amber-500/20 to-amber-600/10",
                "border border-amber-500/30",
                "shadow-lg shadow-amber-500/10",
                "transition-transform hover:scale-[1.02]"
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-amber-400" strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-300">Champion</p>
                <p className="text-[10px] text-amber-400/70">{champ.season}</p>
              </div>
            </div>
          ))}

          {/* Runner-ups - Silver medals */}
          {runnerUps.map((ru) => (
            <div
              key={`ru-${ru.season}`}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg",
                "bg-gradient-to-br from-slate-400/20 to-slate-500/10",
                "border border-slate-400/30",
                "shadow-lg shadow-slate-400/10",
                "transition-transform hover:scale-[1.02]"
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-slate-400/20 flex items-center justify-center">
                <Medal className="w-4 h-4 text-slate-300" strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">Runner-Up</p>
                <p className="text-[10px] text-slate-400">{ru.season}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
