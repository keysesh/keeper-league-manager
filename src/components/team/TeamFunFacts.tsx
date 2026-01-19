"use client";

import { Sparkles, Trophy, ArrowLeftRight, Star, Coins, BarChart3, type LucideIcon } from "lucide-react";

interface FunFact {
  icon: LucideIcon;
  label: string;
  value: string;
}

interface TeamFunFactsProps {
  facts: FunFact[];
}

/**
 * Fun Facts component showing dynamic facts unique to each team
 */
export function TeamFunFacts({ facts }: TeamFunFactsProps) {
  if (facts.length === 0) return null;

  return (
    <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-white">Fun Facts</h2>
        </div>
      </div>
      <div className="p-3 sm:p-5">
        <div className="space-y-2">
          {facts.map((fact, index) => {
            const Icon = fact.icon;
            return (
              <div
                key={index}
                className="flex items-center gap-3 px-3 py-2.5 bg-[#131a28] rounded-lg border border-white/[0.04] hover:bg-[#1a2235] transition-colors"
              >
                <div className="w-7 h-7 rounded-md bg-slate-500/10 border border-slate-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <span className="text-sm text-slate-400 flex-1">{fact.label}</span>
                <span className="text-sm text-white font-medium">{fact.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
