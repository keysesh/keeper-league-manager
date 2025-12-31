"use client";

import { PlayerAvatar, TeamLogo } from "./PlayerAvatar";
import { PositionBadge, RookieBadge } from "../ui/PositionBadge";

interface PlayerCardProps {
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
  };
  keeperInfo?: {
    cost: number;
    yearsKept: number;
    type: string;
  } | null;
  onClick?: () => void;
  compact?: boolean;
  className?: string;
}

export function PlayerCard({
  player,
  keeperInfo,
  onClick,
  compact = false,
  className = "",
}: PlayerCardProps) {
  const isRookie = player.yearsExp === 0;
  const isInjured = !!player.injuryStatus;

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors ${onClick ? "cursor-pointer" : ""} ${className}`}
      >
        <PlayerAvatar sleeperId={player.sleeperId} name={player.fullName} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">{player.fullName}</span>
            <PositionBadge position={player.position} size="xs" />
            {isRookie && <RookieBadge size="xs" />}
          </div>
          <div className="text-xs text-zinc-400">
            {player.team || "FA"} {keeperInfo && `• Rd ${keeperInfo.cost}`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-colors ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      <div className="flex items-start gap-4">
        <PlayerAvatar sleeperId={player.sleeperId} name={player.fullName} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white text-lg truncate">{player.fullName}</h3>
            {isRookie && <RookieBadge />}
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
            <PositionBadge position={player.position} />
            <span>•</span>
            <div className="flex items-center gap-1">
              <TeamLogo team={player.team ?? null} size="xs" />
              <span>{player.team || "Free Agent"}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            {player.age && <span>Age: {player.age}</span>}
            {player.yearsExp !== null && <span>Exp: {player.yearsExp} yr{player.yearsExp !== 1 ? "s" : ""}</span>}
            {isInjured && <span className="text-red-400">{player.injuryStatus}</span>}
          </div>
        </div>
      </div>

      {keeperInfo && (
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Keeper Cost</span>
            <span className="text-white font-medium">Round {keeperInfo.cost}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-zinc-400">Years Kept</span>
            <span className="text-white">{keeperInfo.yearsKept}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-zinc-400">Type</span>
            <span className="text-white capitalize">{keeperInfo.type.toLowerCase()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function PlayerCardList({
  players,
  onPlayerClick,
  compact = false,
}: {
  players: PlayerCardProps["player"][];
  onPlayerClick?: (player: PlayerCardProps["player"]) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-2" : "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}>
      {players.map((player) => (
        <PlayerCard
          key={player.id}
          player={player}
          onClick={onPlayerClick ? () => onPlayerClick(player) : undefined}
          compact={compact}
        />
      ))}
    </div>
  );
}
