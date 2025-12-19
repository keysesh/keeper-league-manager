"use client";

import { Modal } from "../ui/Modal";
import { PlayerAvatar, TeamLogo } from "./PlayerAvatar";
import { PositionBadge, RookieBadge } from "../ui/PositionBadge";
import { StatPill } from "../ui/StatPill";
import { InjuryIndicator } from "../ui/InjuryIndicator";

interface PlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: {
    id: string;
    sleeperId: string;
    fullName: string;
    firstName?: string | null;
    lastName?: string | null;
    position?: string | null;
    team?: string | null;
    age?: number | null;
    yearsExp?: number | null;
    status?: string | null;
    injuryStatus?: string | null;
  } | null;
  eligibility?: {
    isEligible: boolean;
    reason: string | null;
    yearsKept: number;
    acquisitionType: string;
  };
  costs?: {
    franchise: { baseCost: number; finalCost: number; costBreakdown: string } | null;
    regular: { baseCost: number; finalCost: number; costBreakdown: string } | null;
  };
  existingKeeper?: {
    id: string;
    type: string;
    finalCost: number;
    isLocked: boolean;
  } | null;
  keeperHistory?: Array<{
    season: number;
    cost: number;
    type: string;
  }>;
  tradeHistory?: Array<{
    date: string;
    from: string;
    to: string;
  }>;
  onAddKeeper?: (playerId: string, type: "FRANCHISE" | "REGULAR") => void;
  onRemoveKeeper?: (keeperId: string) => void;
  canAddFranchise?: boolean;
  canAddRegular?: boolean;
  isLoading?: boolean;
}

export function PlayerModal({
  isOpen,
  onClose,
  player,
  eligibility,
  costs,
  existingKeeper,
  keeperHistory = [],
  tradeHistory = [],
  onAddKeeper,
  onRemoveKeeper,
  canAddFranchise = true,
  canAddRegular = true,
  isLoading = false,
}: PlayerModalProps) {
  if (!player) return null;

  const isRookie = player.yearsExp === 0;
  const isKeeper = !!existingKeeper;
  const isEligible = eligibility?.isEligible ?? false;

  const getYearsKeptLabel = (years: number): string => {
    if (years === 0) return "New (First Year)";
    if (years >= 2) return "Maxed Out";
    return `Year ${years + 1}`;
  };

  const getAcquisitionLabel = (type: string): string => {
    switch (type) {
      case "DRAFTED": return "Drafted";
      case "WAIVER": return "Waiver Pickup";
      case "FREE_AGENT": return "Free Agent";
      case "TRADE": return "Trade";
      default: return type;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <PlayerAvatar sleeperId={player.sleeperId} name={player.fullName} size="xl" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-white">{player.fullName}</h2>
            {isRookie && <RookieBadge size="md" />}
            {player.injuryStatus && <InjuryIndicator status={player.injuryStatus} compact={false} />}
          </div>
          <div className="flex items-center gap-3 text-gray-400">
            <PositionBadge position={player.position} size="md" />
            <div className="flex items-center gap-2">
              <TeamLogo team={player.team ?? null} size="sm" />
              <span>{player.team || "Free Agent"}</span>
            </div>
          </div>
          {isKeeper && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs font-bold px-2 py-1 rounded ${
                existingKeeper.type === "FRANCHISE"
                  ? "bg-gradient-to-r from-amber-400 to-amber-600 text-black"
                  : "bg-gradient-to-r from-purple-500 to-purple-700 text-white"
              }`}>
                {existingKeeper.type === "FRANCHISE" ? "Franchise Tag" : "Keeper"}
              </span>
              <span className="text-sm text-gray-400">Round {existingKeeper.finalCost}</span>
            </div>
          )}
        </div>
      </div>

      {/* Player Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatBox label="Age" value={player.age ?? "—"} />
        <StatBox label="Experience" value={player.yearsExp !== null ? `${player.yearsExp} yrs` : "—"} />
        <StatBox label="Status" value={player.status || "Active"} />
        <StatBox label="Injury" value={player.injuryStatus || "Healthy"} highlight={!!player.injuryStatus} />
      </div>

      {/* Keeper Eligibility Section */}
      {eligibility && (
        <div className="mb-6 bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Keeper Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Eligibility</div>
              <div className={`text-sm font-semibold ${isEligible ? "text-green-400" : "text-red-400"}`}>
                {isEligible ? "Eligible" : "Not Eligible"}
              </div>
              {!isEligible && eligibility.reason && (
                <div className="text-xs text-gray-500 mt-1">{eligibility.reason}</div>
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Years Kept</div>
              <div className="text-sm font-semibold text-white">{getYearsKeptLabel(eligibility.yearsKept)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Acquisition</div>
              <div className="text-sm font-semibold text-white">{getAcquisitionLabel(eligibility.acquisitionType)}</div>
            </div>
          </div>

          {/* Cost Breakdown */}
          {costs && (costs.regular || costs.franchise) && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="text-xs text-gray-500 mb-2">Cost Breakdown</div>
              <div className="flex flex-wrap gap-3">
                {costs.regular && (
                  <div className="flex items-center gap-2">
                    <StatPill value={`R${costs.regular.finalCost}`} variant="primary" />
                    <span className="text-xs text-gray-400">{costs.regular.costBreakdown}</span>
                  </div>
                )}
                {costs.franchise && (
                  <div className="flex items-center gap-2">
                    <StatPill value="FT" variant="warning" />
                    <span className="text-xs text-gray-400">{costs.franchise.costBreakdown}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keeper History */}
      {keeperHistory.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Keeper History</h3>
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Season</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Cost</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {keeperHistory.map((entry, i) => (
                  <tr key={i} className="border-b border-gray-800 last:border-0">
                    <td className="py-2 px-3 text-white">{entry.season}</td>
                    <td className="py-2 px-3 text-white">Round {entry.cost}</td>
                    <td className="py-2 px-3 text-white capitalize">{entry.type.toLowerCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trade History */}
      {tradeHistory.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Trade History</h3>
          <div className="space-y-2">
            {tradeHistory.map((trade, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-gray-900 rounded-lg p-3">
                <span className="text-gray-500">{trade.date}</span>
                <span className="text-gray-400">{trade.from}</span>
                <span className="text-gray-500">→</span>
                <span className="text-white">{trade.to}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {(onAddKeeper || onRemoveKeeper) && (
        <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
          {!isKeeper && isEligible && costs && onAddKeeper && (
            <>
              {costs.regular && (
                <button
                  onClick={() => onAddKeeper(player.id, "REGULAR")}
                  disabled={!canAddRegular || isLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-colors"
                >
                  {isLoading ? "Adding..." : `Keep as Round ${costs.regular.finalCost}`}
                </button>
              )}
              {costs.franchise && (
                <button
                  onClick={() => onAddKeeper(player.id, "FRANCHISE")}
                  disabled={!canAddFranchise || isLoading}
                  className="px-4 py-2.5 rounded-lg text-sm font-bold bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40 transition-colors"
                >
                  {isLoading ? "..." : "Franchise Tag"}
                </button>
              )}
            </>
          )}
          {isKeeper && !existingKeeper.isLocked && onRemoveKeeper && (
            <button
              onClick={() => onRemoveKeeper(existingKeeper.id)}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-lg text-sm font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
            >
              {isLoading ? "Removing..." : "Remove Keeper"}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </Modal>
  );
}

function StatBox({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3 text-center">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-semibold ${highlight ? "text-red-400" : "text-white"}`}>{value}</div>
    </div>
  );
}
