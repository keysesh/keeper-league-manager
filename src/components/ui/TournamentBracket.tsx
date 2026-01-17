"use client";

import { memo } from "react";
import { Trophy, Crown, Medal } from "lucide-react";

interface TeamInfo {
  id: string;
  teamName: string | null;
  ownerName: string | null;
  wins?: number;
  losses?: number;
  pointsFor?: number;
}

interface BracketMatchup {
  round: number;
  matchupId: number;
  team1: TeamInfo | null;
  team2: TeamInfo | null;
  team1From?: { w?: number; l?: number };
  team2From?: { w?: number; l?: number };
  winner: TeamInfo | null;
  loser: TeamInfo | null;
  placement?: number;
}

interface TournamentBracketProps {
  winnersBracket: BracketMatchup[];
  losersBracket?: BracketMatchup[];
  playoffTeams: number;
}

function groupByRound(matchups: BracketMatchup[]): Map<number, BracketMatchup[]> {
  const map = new Map<number, BracketMatchup[]>();
  matchups.forEach(m => {
    if (!map.has(m.round)) map.set(m.round, []);
    map.get(m.round)!.push(m);
  });
  return map;
}

function getRoundName(round: number, totalRounds: number): string {
  if (round === totalRounds) return "Finals";
  if (round === totalRounds - 1) return "Semis";
  if (round === totalRounds - 2) return "Quarters";
  return "Round " + round;
}

function getSlotClasses(isWinner: boolean, isTop: boolean): string {
  const base = "relative flex items-center gap-2 px-3 py-2 min-w-[160px]";
  const rounded = isTop ? "rounded-t-lg" : "rounded-b-lg";
  const bg = isWinner ? "bg-emerald-500/10" : "bg-zinc-800/50";
  const border = isTop ? "border-t border-x border-zinc-700/50" : "border-b border-x border-zinc-700/50";
  return base + " " + rounded + " " + bg + " " + border;
}

function getTextClasses(isWinner: boolean, hasTeam: boolean): string {
  if (isWinner) return "text-emerald-400";
  if (hasTeam) return "text-white";
  return "text-zinc-600";
}

function getPlacementClasses(placement: number): string {
  const base = "absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded text-[9px] font-bold";
  if (placement === 1) return base + " bg-amber-500 text-black";
  if (placement === 2) return base + " bg-zinc-300 text-black";
  if (placement === 3) return base + " bg-amber-700 text-white";
  return base + " bg-zinc-600 text-white";
}

const MatchupSlot = memo(function MatchupSlot({
  team,
  isWinner,
  isTop,
}: {
  team: TeamInfo | null;
  isWinner: boolean;
  isTop: boolean;
}) {
  return (
    <div className={getSlotClasses(isWinner, isTop)}>
      {isWinner && (
        <Trophy className="w-3 h-3 text-emerald-400 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={"text-xs font-medium truncate " + getTextClasses(isWinner, !!team)}>
          {team?.teamName || "TBD"}
        </p>
        {team?.ownerName && (
          <p className="text-[9px] text-zinc-500 truncate">{team.ownerName}</p>
        )}
      </div>
      {team?.wins !== undefined && (
        <span className="text-[10px] text-zinc-500 font-mono">
          {team.wins}-{team.losses}
        </span>
      )}
    </div>
  );
});

const Matchup = memo(function Matchup({
  matchup,
  isLastRound,
}: {
  matchup: BracketMatchup;
  isLastRound: boolean;
}) {
  const hasWinner = matchup.winner !== null;
  const isChampionship = matchup.placement === 1;

  const containerClasses = isChampionship 
    ? "relative rounded-lg overflow-hidden ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/10"
    : "relative rounded-lg overflow-hidden";

  return (
    <div className="relative">
      {isChampionship && hasWinner && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1">
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-[10px] font-bold text-amber-400">CHAMPION</span>
        </div>
      )}

      <div className={containerClasses}>
        <MatchupSlot
          team={matchup.team1}
          isWinner={matchup.winner?.id === matchup.team1?.id}
          isTop={true}
        />
        
        <div className="h-px bg-zinc-700/50" />
        
        <MatchupSlot
          team={matchup.team2}
          isWinner={matchup.winner?.id === matchup.team2?.id}
          isTop={false}
        />

        {matchup.placement && matchup.placement <= 3 && hasWinner && (
          <div className={getPlacementClasses(matchup.placement)}>
            {matchup.placement === 1 ? "1st" : matchup.placement === 2 ? "2nd" : "3rd"}
          </div>
        )}
      </div>

      {!isLastRound && (
        <div className="absolute top-1/2 -right-4 w-4 h-px bg-zinc-700" />
      )}
    </div>
  );
});

export const TournamentBracket = memo(function TournamentBracket({
  winnersBracket,
  losersBracket,
}: TournamentBracketProps) {
  if (!winnersBracket || winnersBracket.length === 0) {
    return (
      <div className="text-center py-8">
        <Trophy className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">Playoff bracket not available yet</p>
        <p className="text-xs text-zinc-600 mt-1">
          The bracket will appear once playoffs begin
        </p>
      </div>
    );
  }

  const roundsMap = groupByRound(winnersBracket);
  const rounds = Array.from(roundsMap.entries()).sort(([a], [b]) => a - b);
  const totalRounds = rounds.length;

  const championship = winnersBracket.find(m => m.placement === 1);

  return (
    <div className="space-y-6">
      {championship?.winner && (
        <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 rounded-xl p-4 border border-amber-500/20">
          <div className="flex items-center justify-center gap-3">
            <Crown className="w-6 h-6 text-amber-400" />
            <div className="text-center">
              <p className="text-[10px] text-amber-400 font-medium uppercase tracking-wider">
                League Champion
              </p>
              <p className="text-lg font-bold text-white">
                {championship.winner.teamName || "Unnamed Team"}
              </p>
              {championship.winner.ownerName && (
                <p className="text-xs text-amber-200/60">
                  {championship.winner.ownerName}
                </p>
              )}
            </div>
            <Crown className="w-6 h-6 text-amber-400" />
          </div>
        </div>
      )}

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-8 min-w-max px-4">
          {rounds.map(([round, matchups], roundIndex) => {
            const isLastRound = roundIndex === rounds.length - 1;
            const spacingMultiplier = Math.pow(2, roundIndex);

            return (
              <div key={round} className="flex flex-col">
                <div className="text-center mb-4">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    {getRoundName(round, totalRounds)}
                  </span>
                </div>

                <div
                  className="flex flex-col justify-around flex-1"
                  style={{ gap: spacingMultiplier * 24 + "px" }}
                >
                  {matchups.map((matchup) => (
                    <Matchup
                      key={matchup.matchupId}
                      matchup={matchup}
                      isLastRound={isLastRound}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {losersBracket && losersBracket.length > 0 && (
        <div className="pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <Medal className="w-4 h-4 text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Consolation
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {losersBracket.slice(0, 4).map(matchup => {
              const team1Winner = matchup.winner?.id === matchup.team1?.id;
              const team2Winner = matchup.winner?.id === matchup.team2?.id;
              return (
                <div
                  key={matchup.matchupId}
                  className="bg-zinc-800/30 rounded-lg overflow-hidden min-w-[150px]"
                >
                  <div className="px-2 py-1 bg-zinc-800/50 border-b border-zinc-700/30">
                    <span className="text-[9px] text-zinc-600">
                      R{matchup.round} M{matchup.matchupId}
                    </span>
                  </div>
                  <div className="p-2 space-y-1">
                    <div className={"text-xs truncate " + (team1Winner ? "text-emerald-400" : "text-zinc-400")}>
                      {matchup.team1?.teamName || "TBD"}
                    </div>
                    <div className={"text-xs truncate " + (team2Winner ? "text-emerald-400" : "text-zinc-400")}>
                      {matchup.team2?.teamName || "TBD"}
                    </div>
                  </div>
                  {matchup.placement && (
                    <div className="px-2 py-1 bg-zinc-700/30 text-[9px] text-zinc-500 text-center">
                      {matchup.placement}th Place
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
