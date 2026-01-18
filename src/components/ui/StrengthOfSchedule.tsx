"use client";

import { useMemo } from "react";
import { Shield, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface TeamSOS {
  team: string;
  sosRank: number;
  sosRating: number; // 1-32, lower = harder schedule
  passDef: number;
  rushDef: number;
  byeWeek: number | null;
}

interface StrengthOfScheduleProps {
  scheduleData: TeamSOS[];
  highlightTeams?: string[];
  compact?: boolean;
}

/**
 * Strength of Schedule display
 * Shows defensive rankings and schedule difficulty
 */
export function StrengthOfSchedule({ scheduleData, highlightTeams = [], compact = false }: StrengthOfScheduleProps) {
  const sortedTeams = useMemo(() => {
    return [...scheduleData].sort((a, b) => a.sosRank - b.sosRank);
  }, [scheduleData]);

  // Categorize SOS
  const getSOSCategory = (rank: number): { label: string; color: string; bgColor: string } => {
    if (rank <= 8) return { label: "Hard", color: "text-red-400", bgColor: "bg-red-500/10" };
    if (rank <= 16) return { label: "Avg+", color: "text-amber-400", bgColor: "bg-amber-500/10" };
    if (rank <= 24) return { label: "Avg-", color: "text-blue-400", bgColor: "bg-blue-500/10" };
    return { label: "Easy", color: "text-emerald-400", bgColor: "bg-emerald-500/10" };
  };

  if (compact) {
    // Compact view for player cards
    const relevantTeams = scheduleData.filter(t => highlightTeams.includes(t.team));

    return (
      <div className="flex items-center gap-1">
        {relevantTeams.map((team) => {
          const category = getSOSCategory(team.sosRank);
          return (
            <span
              key={team.team}
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${category.bgColor} ${category.color}`}
              title={`${team.team} SOS: #${team.sosRank} (${category.label})`}
            >
              {team.team} #{team.sosRank}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          <h3 className="font-semibold text-white text-sm">Strength of Schedule</h3>
          <span className="text-[10px] text-gray-500 ml-auto">Lower = Harder Schedule</span>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-b border-[#222] flex items-center gap-3 text-[9px]">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-red-500"></span>
          <span className="text-red-400">Hard (1-8)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-amber-500"></span>
          <span className="text-amber-400">Avg+ (9-16)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-blue-500"></span>
          <span className="text-blue-400">Avg- (17-24)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-emerald-500"></span>
          <span className="text-emerald-400">Easy (25-32)</span>
        </span>
      </div>

      <div className="max-h-96 overflow-y-auto">
        <div className="divide-y divide-[#222]">
          {sortedTeams.map((team) => {
            const category = getSOSCategory(team.sosRank);
            const isHighlighted = highlightTeams.includes(team.team);

            return (
              <div
                key={team.team}
                className={`px-4 py-2.5 flex items-center gap-3 ${
                  isHighlighted ? "bg-blue-500/10" : "hover:bg-[#222]"
                }`}
              >
                {/* Rank */}
                <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-sm ${category.bgColor} ${category.color}`}>
                  {team.sosRank}
                </div>

                {/* Team */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isHighlighted ? "text-blue-400" : "text-white"}`}>
                      {team.team}
                    </span>
                    {team.sosRank <= 5 && <span title="Very hard schedule"><TrendingDown className="w-3 h-3 text-red-400" /></span>}
                    {team.sosRank >= 28 && <span title="Very easy schedule"><TrendingUp className="w-3 h-3 text-emerald-400" /></span>}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>Pass DEF: #{team.passDef}</span>
                    <span>Rush DEF: #{team.rushDef}</span>
                    {team.byeWeek && <span className="text-gray-400">Bye: Wk {team.byeWeek}</span>}
                  </div>
                </div>

                {/* SOS Rating */}
                <div className="text-right">
                  <span className={`text-sm font-semibold ${category.color}`}>
                    {category.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary note */}
      <div className="px-4 py-2 border-t border-[#2a2a2a] text-[10px] text-gray-500">
        <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-400" />
        Schedule strength matters for borderline keeper decisions. Easy schedules can boost production.
      </div>
    </div>
  );
}

/**
 * Compact SOS badge for player cards
 */
export function SOSBadge({ team, sosRank }: { team: string; sosRank: number }) {
  const category =
    sosRank <= 8 ? { label: "Hard", color: "text-red-400", bg: "bg-red-500/10" } :
    sosRank <= 16 ? { label: "Avg+", color: "text-amber-400", bg: "bg-amber-500/10" } :
    sosRank <= 24 ? { label: "Avg-", color: "text-blue-400", bg: "bg-blue-500/10" } :
    { label: "Easy", color: "text-emerald-400", bg: "bg-emerald-500/10" };

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${category.bg} ${category.color}`}
      title={`${team} strength of schedule: #${sosRank} (${category.label})`}
    >
      <Shield className="w-2.5 h-2.5" />
      #{sosRank}
    </span>
  );
}
