"use client";

import { memo } from "react";
import { PlayerAvatar, TeamLogo } from "./PlayerAvatar";
import { PositionBadge, RookieBadge } from "../ui/PositionBadge";
import { InjuryIndicator } from "../ui/InjuryIndicator";

interface NFLVerseMetadata {
  gsisId?: string;
  espnId?: string;
  headshotUrl?: string;
  ranking?: {
    ecr?: number;
    positionRank?: number;
    rankingDate?: string;
  };
  depthChart?: {
    depthPosition?: number;
    formation?: string;
  };
  injury?: {
    status?: string;
    primaryInjury?: string;
    secondaryInjury?: string;
    practiceStatus?: string;
  };
}

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
    metadata?: { nflverse?: NFLVerseMetadata } | null;
  };
  keeperInfo?: {
    cost: number;
    yearsKept: number;
    type: string;
  } | null;
  /** Team's bye week (pass from schedule context) */
  byeWeek?: number | null;
  onClick?: () => void;
  compact?: boolean;
  className?: string;
}

export const PlayerCard = memo(function PlayerCard({
  player,
  keeperInfo,
  byeWeek,
  onClick,
  compact = false,
  className = "",
}: PlayerCardProps) {
  const isRookie = player.yearsExp === 0;
  const nflverse = player.metadata?.nflverse;
  const injuryStatus = nflverse?.injury?.status || player.injuryStatus;
  const isInjured = !!injuryStatus;
  const positionRank = nflverse?.ranking?.positionRank;
  const ecr = nflverse?.ranking?.ecr;
  const isStarter = nflverse?.depthChart?.depthPosition === 1;

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors ${onClick ? "cursor-pointer" : ""} ${className}`}
      >
        <PlayerAvatar
            sleeperId={player.sleeperId}
            name={player.fullName}
            size="sm"
            nflverseHeadshot={nflverse?.headshotUrl}
            gsisId={nflverse?.gsisId}
            espnId={nflverse?.espnId}
          />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">{player.fullName}</span>
            <PositionBadge position={player.position} size="xs" />
            {positionRank && (
              <span className="text-[9px] font-bold text-gray-400">#{positionRank}</span>
            )}
            {isRookie && <RookieBadge size="xs" />}
            {isStarter && (
              <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400">ST</span>
            )}
            {isInjured && <InjuryIndicator status={injuryStatus} />}
          </div>
          <div className="text-xs text-zinc-400">
            {player.team || "FA"} {byeWeek && `• Bye ${byeWeek}`} {ecr && `• ECR #${Math.round(ecr)}`} {keeperInfo && `• Rd ${keeperInfo.cost}`}
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
        <PlayerAvatar
          sleeperId={player.sleeperId}
          name={player.fullName}
          size="lg"
          nflverseHeadshot={nflverse?.headshotUrl}
          gsisId={nflverse?.gsisId}
          espnId={nflverse?.espnId}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white text-lg truncate">{player.fullName}</h3>
            {isRookie && <RookieBadge />}
            {isStarter && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">STARTER</span>
            )}
            {isInjured && <InjuryIndicator status={injuryStatus} compact={false} />}
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
            <PositionBadge position={player.position} />
            {positionRank && (
              <span className="text-xs font-bold text-purple-400">#{positionRank}</span>
            )}
            <span>•</span>
            <div className="flex items-center gap-1">
              <TeamLogo team={player.team ?? null} size="xs" />
              <span>{player.team || "Free Agent"}</span>
            </div>
            {ecr && (
              <>
                <span>•</span>
                <span className="text-purple-400">ECR #{Math.round(ecr)}</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            {player.age && <span>Age: {player.age}</span>}
            {player.yearsExp !== null && <span>Exp: {player.yearsExp} yr{player.yearsExp !== 1 ? "s" : ""}</span>}
            {byeWeek && <span>Bye: Wk {byeWeek}</span>}
            {nflverse?.injury?.primaryInjury && (
              <span className="text-red-400">{nflverse.injury.primaryInjury}</span>
            )}
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
});

export const PlayerCardList = memo(function PlayerCardList({
  players,
  onPlayerClick,
  compact = false,
  byeWeeks,
}: {
  players: PlayerCardProps["player"][];
  onPlayerClick?: (player: PlayerCardProps["player"]) => void;
  compact?: boolean;
  /** Lookup of team -> bye week */
  byeWeeks?: Record<string, number>;
}) {
  return (
    <div className={compact ? "space-y-2" : "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}>
      {players.map((player) => (
        <PlayerCard
          key={player.id}
          player={player}
          onClick={onPlayerClick ? () => onPlayerClick(player) : undefined}
          compact={compact}
          byeWeek={player.team && byeWeeks ? byeWeeks[player.team] : undefined}
        />
      ))}
    </div>
  );
});
