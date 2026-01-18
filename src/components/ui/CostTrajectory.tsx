"use client";

interface CostYear {
  year: number;
  cost: number;
  isFinalYear: boolean;
}

interface CostTrajectoryProps {
  trajectory: CostYear[];
  currentCost: number;
  yearsKept: number;
  maxYears: number;
  playerName?: string;
  compact?: boolean;
}

/**
 * Displays keeper cost trajectory over multiple years
 * Shows cost escalation and when keeper expires
 */
export function CostTrajectory({
  trajectory,
  currentCost,
  yearsKept,
  maxYears,
  playerName,
  compact = false,
}: CostTrajectoryProps) {
  const yearsRemaining = maxYears - yearsKept;
  const currentSeason = new Date().getFullYear();
  const planningSeason = currentSeason + (new Date().getMonth() >= 2 ? 1 : 0); // After March, plan for next year

  if (compact) {
    // Compact inline view for tight spaces
    return (
      <div className="flex items-center gap-1 text-[10px]">
        {trajectory.slice(0, 3).map((year, idx) => (
          <span
            key={year.year}
            className={`
              px-1.5 py-0.5 rounded font-medium
              ${idx === 0 ? "bg-blue-500/20 text-blue-400" : "bg-gray-800 text-gray-400"}
              ${year.isFinalYear ? "border border-amber-500/30" : ""}
            `}
            title={`Year ${year.year}: Round ${year.cost}${year.isFinalYear ? " (Final Year)" : ""}`}
          >
            R{year.cost}
          </span>
        ))}
        {trajectory.length > 3 && (
          <span className="text-gray-500">+{trajectory.length - 3}</span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md bg-[#1a1a1a] border border-[#2a2a2a] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Cost Trajectory
        </span>
        {yearsRemaining > 0 && (
          <span className="text-[10px] text-gray-500">
            {yearsRemaining} year{yearsRemaining !== 1 ? "s" : ""} remaining
          </span>
        )}
      </div>

      {playerName && (
        <p className="text-sm font-medium text-white mb-2">{playerName}</p>
      )}

      {/* Timeline view */}
      <div className="flex items-stretch gap-1">
        {trajectory.map((year, idx) => {
          const season = planningSeason + idx;
          const isNext = idx === 0;

          return (
            <div
              key={year.year}
              className={`
                flex-1 min-w-0 p-2 rounded text-center
                ${isNext ? "bg-blue-500/15 border border-blue-500/30" : "bg-[#222222]"}
                ${year.isFinalYear ? "border-t-2 border-t-amber-500" : ""}
              `}
            >
              <div className="text-[9px] text-gray-500 uppercase mb-1">
                {season}
              </div>
              <div
                className={`text-sm font-bold ${
                  isNext ? "text-blue-400" : "text-gray-300"
                }`}
              >
                R{year.cost}
              </div>
              <div className="text-[9px] text-gray-500 mt-0.5">
                Yr {yearsKept + idx + 1}
              </div>
              {year.isFinalYear && (
                <div className="text-[8px] text-amber-400 mt-1">Final</div>
              )}
            </div>
          );
        })}

        {/* After expiration */}
        {trajectory.length > 0 && (
          <div className="flex-1 min-w-0 p-2 rounded bg-[#222222] text-center opacity-50">
            <div className="text-[9px] text-gray-500 uppercase mb-1">
              {planningSeason + trajectory.length}
            </div>
            <div className="text-sm font-bold text-gray-500">—</div>
            <div className="text-[8px] text-red-400 mt-1">Expired</div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#2a2a2a] text-[10px] text-gray-500">
        <span>
          Currently R{currentCost} • Kept {yearsKept}/{maxYears} years
        </span>
        {trajectory.some((t) => t.cost === 1) && (
          <span className="text-emerald-400">Hits R1 minimum</span>
        )}
      </div>
    </div>
  );
}

/**
 * Mini cost badge showing next year's cost
 */
export function CostBadge({
  cost,
  yearsKept,
  maxYears,
  isFranchise = false,
}: {
  cost: number;
  yearsKept: number;
  maxYears: number;
  isFranchise?: boolean;
}) {
  const yearsRemaining = maxYears - yearsKept;
  const isLastYear = yearsRemaining === 1;

  return (
    <div className="flex items-center gap-1">
      <span
        className={`
          inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold
          ${isFranchise
            ? "bg-blue-500 text-white"
            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
          }
        `}
      >
        R{cost}
      </span>
      {!isFranchise && (
        <span
          className={`text-[9px] font-medium ${
            isLastYear ? "text-amber-400" : "text-gray-500"
          }`}
          title={`${yearsRemaining} year${yearsRemaining !== 1 ? "s" : ""} remaining as keeper`}
        >
          {yearsKept}/{maxYears}
        </span>
      )}
    </div>
  );
}

/**
 * Calculate cost trajectory for a player
 */
export function calculateCostTrajectory(
  startingCost: number,
  startingYearsKept: number,
  maxYears: number,
  minRound: number = 1
): CostYear[] {
  const trajectory: CostYear[] = [];
  const yearsRemaining = maxYears - startingYearsKept;

  for (let year = 1; year <= yearsRemaining; year++) {
    const yearCost = Math.max(minRound, startingCost - (year - 1));
    trajectory.push({
      year,
      cost: yearCost,
      isFinalYear: year === yearsRemaining,
    });
  }

  return trajectory;
}
