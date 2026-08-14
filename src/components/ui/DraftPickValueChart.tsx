"use client";

import { LEAGUE_CONFIG, getDraftPickValue } from "@/lib/constants/league-config";
import { InfoModal } from "./InfoModal";

export type PickStatus = "KEEPER" | "TRADED" | "OPEN";

interface DraftPickValueChartProps {
  highlightRound?: number;
  compact?: boolean;
  /** Ownership state per round — adds the STATUS column when provided. */
  statuses?: Record<number, PickStatus>;
}

const STATUS_STYLES: Record<PickStatus, string> = {
  KEEPER: "text-amber-400",
  TRADED: "text-orange-400",
  OPEN: "text-slate-500",
};

// Hex pairs behind each tier class, for the traded-row hatch fill
const TIER_HEX: Record<string, [string, string]> = {
  "bg-yellow-500": ["#eab308", "#a16207"],
  "bg-emerald-500": ["#10b981", "#047857"],
  "bg-blue-500": ["#3b82f6", "#1d4ed8"],
  "bg-amber-500": ["#f59e0b", "#b45309"],
  "bg-gray-500": ["#6b7280", "#374151"],
};

/**
 * Visual chart showing draft pick values by round
 * Useful for understanding keeper cost trade-offs
 */
export function DraftPickValueChart({ highlightRound, compact = false, statuses }: DraftPickValueChartProps) {
  const rounds = Object.keys(LEAGUE_CONFIG.draftPickValues).map(Number).sort((a, b) => a - b);
  const maxValue = Math.max(...Object.values(LEAGUE_CONFIG.draftPickValues));

  if (compact) {
    return (
      <div className="flex items-end gap-0.5 h-8">
        {rounds.slice(0, 8).map((round) => {
          const value = getDraftPickValue(round);
          const height = (value / maxValue) * 100;
          const isHighlighted = round === highlightRound;

          return (
            <div
              key={round}
              className="flex-1 flex flex-col items-center"
              title={`Round ${round}: ${value} value`}
            >
              <div
                className={`w-full rounded-t transition-colors ${
                  isHighlighted ? "bg-blue-500" :
                  round <= 3 ? "bg-emerald-500/60" :
                  round <= 6 ? "bg-amber-500/60" :
                  "bg-gray-600"
                }`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-[#0c1219] border border-white/[0.08] border-t-white/[0.12] rounded-xl px-[15px] py-3.5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white text-[12.5px]">Draft pick value</h3>
          <InfoModal
            title="Draft Pick Values"
            description={
              <>
                Draft pick values represent the relative worth of each pick for keeper cost analysis.
                These values help you understand the trade-off between keeping a player at a certain round
                cost versus drafting fresh talent.
              </>
            }
            formula={{
              label: "Value Formula",
              expression: "Value = 100 × (1 - (round - 1) / 15)^1.5",
              variables: [
                { name: "round", description: "The draft round (1-15)" },
                { name: "100", description: "Maximum value (Round 1)" },
              ],
            }}
            examples={[
              {
                label: "Round 1 Keeper",
                description: "A player kept at Round 1 costs your highest value pick",
                result: "Value: 100",
              },
              {
                label: "Round 5 Keeper",
                description: "Mid-round keeper provides good value while costing less",
                result: "Value: 59",
              },
              {
                label: "Undrafted Player",
                description: `Undrafted players are kept at Round ${LEAGUE_CONFIG.keeperRules.undraftedRound}`,
                result: `Value: ${getDraftPickValue(LEAGUE_CONFIG.keeperRules.undraftedRound)}`,
              },
            ]}
            interpretation={[
              { value: "100", meaning: "Elite (R1) - Premium pick", color: "text-yellow-400" },
              { value: "75-99", meaning: "Premium (R2-3)", color: "text-emerald-400" },
              { value: "50-74", meaning: "Starter (R4-6)", color: "text-blue-400" },
              { value: "25-49", meaning: "Depth (R7-10)", color: "text-amber-400" },
              { value: "< 25", meaning: "Lottery (R11+)", color: "text-gray-400" },
            ]}
            sections={[
              {
                title: "Keeper Strategy Tip",
                content: (
                  <p>
                    Lower keeper cost = higher value. A player you drafted in Round 10 who becomes a star
                    is more valuable to keep than a Round 1 pick, because you&apos;re saving premium draft capital.
                  </p>
                ),
              },
            ]}
            iconSize={14}
          />
        </div>
        <span className="font-mono text-[10px] font-medium text-slate-600">
          {statuses ? "VALUE · STATUS" : "VALUE"}
        </span>
      </div>

      {/* Value bars */}
      <div className="space-y-1.5">
        {rounds.map((round) => {
          const value = getDraftPickValue(round);
          const width = (value / maxValue) * 100;
          const isHighlighted = round === highlightRound;

          // Tier coloring
          const tierColor =
            round === 1 ? "bg-yellow-500" :
            round <= 3 ? "bg-emerald-500" :
            round <= 6 ? "bg-blue-500" :
            round <= 10 ? "bg-amber-500" :
            "bg-gray-500";

          const tierLabel =
            round === 1 ? "Elite" :
            round <= 3 ? "Premium" :
            round <= 6 ? "Starter" :
            round <= 10 ? "Depth" :
            "Lottery";

          const status = statuses?.[round];
          const [tierHex, tierDark] = TIER_HEX[tierColor] ?? ["#6b7280", "#374151"];
          const isTraded = status === "TRADED";

          return (
            <div
              key={round}
              className={`flex items-center gap-2 rounded transition-colors ${
                isHighlighted ? "bg-blue-500/10 ring-1 ring-blue-500/30 p-1.5" : ""
              } ${isTraded ? "opacity-55" : ""}`}
            >
              <span
                className={`w-[22px] font-mono text-[10.5px] font-medium ${
                  isHighlighted ? "text-blue-400" : "text-slate-400"
                }`}
              >
                R{round}
              </span>
              <div className="flex-1 h-3.5 bg-[#080d14] rounded-[7px] overflow-hidden">
                <div
                  className={`h-full rounded-[7px] transition-all ${isTraded ? "" : tierColor}`}
                  style={{
                    width: `${width}%`,
                    ...(isTraded
                      ? {
                          background: `repeating-linear-gradient(135deg, ${tierHex} 0 3px, ${tierDark} 3px 6px)`,
                        }
                      : {}),
                  }}
                />
              </div>
              <span
                className={`w-[22px] font-mono text-[10.5px] font-semibold text-right ${
                  isHighlighted ? "text-blue-400" : "text-slate-50"
                }`}
              >
                {value}
              </span>
              {statuses ? (
                <span
                  className={`w-[46px] font-mono text-[8.5px] font-semibold tracking-[0.05em] text-right ${
                    STATUS_STYLES[status ?? "OPEN"]
                  }`}
                >
                  {status ?? "OPEN"}
                </span>
              ) : (
                <span className="w-16 text-[9px] text-slate-500 text-right">{tierLabel}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-white/[0.06] text-[9.5px] font-medium text-slate-400">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-yellow-500"></span>
          <span>Elite (R1)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-emerald-500"></span>
          <span>Premium (R2-3)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-blue-500"></span>
          <span>Starter (R4-6)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-amber-500"></span>
          <span>Depth (R7-10)</span>
        </div>
      </div>

      {/* Keeper cost note */}
      <div className="mt-3 p-2.5 bg-[#111822] rounded-md text-[10px] leading-[1.45] text-slate-400">
        <strong className="text-slate-300">Keeper cost tip:</strong> lower round = higher value.
        A R3 keeper saves you a premium pick. Undrafted players cost R{LEAGUE_CONFIG.keeperRules.undraftedRound}.
      </div>
    </div>
  );
}

/**
 * Inline pick value badge
 */
export function PickValueBadge({ round }: { round: number }) {
  const value = getDraftPickValue(round);
  const tier =
    round === 1 ? "elite" :
    round <= 3 ? "premium" :
    round <= 6 ? "starter" :
    "depth";

  const colors = {
    elite: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    premium: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    starter: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    depth: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors[tier]}`}
      title={`Round ${round} pick - Value: ${value}`}
    >
      R{round}
      <span className="opacity-60">{value}v</span>
    </span>
  );
}
