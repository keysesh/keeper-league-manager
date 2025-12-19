"use client";

import { Modal } from "../ui/Modal";
import { PlayerAvatar, TeamLogo } from "./PlayerAvatar";
import { PositionBadge, RookieBadge } from "../ui/PositionBadge";

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
}

export function PlayerModal({
  isOpen,
  onClose,
  player,
  keeperHistory = [],
  tradeHistory = [],
}: PlayerModalProps) {
  if (!player) return null;

  const isRookie = player.yearsExp === 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="flex items-start gap-4 mb-6">
        <PlayerAvatar sleeperId={player.sleeperId} name={player.fullName} size="xl" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-white">{player.fullName}</h2>
            {isRookie && <RookieBadge size="md" />}
          </div>
          <div className="flex items-center gap-3 text-gray-400">
            <PositionBadge position={player.position} size="md" />
            <div className="flex items-center gap-2">
              <TeamLogo team={player.team ?? null} size="sm" />
              <span>{player.team || "Free Agent"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatBox label="Age" value={player.age ?? "—"} />
        <StatBox label="Experience" value={player.yearsExp !== null ? `${player.yearsExp} yrs` : "—"} />
        <StatBox label="Status" value={player.status || "Active"} />
        <StatBox label="Injury" value={player.injuryStatus || "Healthy"} highlight={!!player.injuryStatus} />
      </div>

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

      {tradeHistory.length > 0 && (
        <div>
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
