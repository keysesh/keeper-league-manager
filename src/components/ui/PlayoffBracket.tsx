"use client";

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

interface PlayoffBracketProps {
  winnersBracket: BracketMatchup[];
  losersBracket?: BracketMatchup[];
  playoffTeams: number;
  showLosersBracket?: boolean;
}

function getPlacementLabel(placement: number): string {
  if (placement === 1) return "Champion";
  if (placement === 2) return "Runner-up";
  if (placement === 3) return "3rd Place";
  if (placement === 4) return "4th Place";
  if (placement === 5) return "5th Place";
  if (placement === 6) return "6th Place";
  return `${placement}th Place`;
}

function getPlacementStyle(placement: number): { bg: string; text: string; icon?: React.ReactNode } {
  if (placement === 1) {
    return {
      bg: "bg-gradient-to-r from-amber-500 to-yellow-400",
      text: "text-black",
      icon: <Crown className="w-4 h-4" />,
    };
  }
  if (placement === 2) {
    return {
      bg: "bg-gradient-to-r from-zinc-300 to-zinc-400",
      text: "text-black",
      icon: <Medal className="w-4 h-4" />,
    };
  }
  if (placement === 3) {
    return {
      bg: "bg-gradient-to-r from-amber-600 to-amber-700",
      text: "text-white",
      icon: <Medal className="w-4 h-4" />,
    };
  }
  return {
    bg: "bg-zinc-700",
    text: "text-zinc-300",
  };
}

function MatchupCard({ matchup, showRound = true }: { matchup: BracketMatchup; showRound?: boolean }) {
  const isComplete = matchup.winner !== null;

  return (
    <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-hidden min-w-[200px]">
      {showRound && (
        <div className="px-3 py-1.5 bg-zinc-800/50 border-b border-zinc-800">
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
            Round {matchup.round} - Match {matchup.matchupId}
          </span>
        </div>
      )}
      <div className="divide-y divide-zinc-800">
        <TeamSlot
          team={matchup.team1}
          isWinner={matchup.winner?.id === matchup.team1?.id}
          fromLabel={matchup.team1From ? formatFromLabel(matchup.team1From) : undefined}
        />
        <TeamSlot
          team={matchup.team2}
          isWinner={matchup.winner?.id === matchup.team2?.id}
          fromLabel={matchup.team2From ? formatFromLabel(matchup.team2From) : undefined}
        />
      </div>
      {matchup.placement && (
        <div className={`px-3 py-2 ${getPlacementStyle(matchup.placement).bg}`}>
          <div className={`flex items-center gap-2 text-xs font-bold ${getPlacementStyle(matchup.placement).text}`}>
            {getPlacementStyle(matchup.placement).icon}
            {getPlacementLabel(matchup.placement)}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamSlot({
  team,
  isWinner,
  fromLabel,
}: {
  team: TeamInfo | null;
  isWinner: boolean;
  fromLabel?: string;
}) {
  if (!team && fromLabel) {
    return (
      <div className="px-3 py-2.5 flex items-center gap-2">
        <span className="text-xs text-zinc-600 italic">{fromLabel}</span>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="px-3 py-2.5 flex items-center gap-2">
        <span className="text-xs text-zinc-600">TBD</span>
      </div>
    );
  }

  return (
    <div
      className={`px-3 py-2.5 flex items-center gap-2 transition-colors ${
        isWinner ? "bg-emerald-500/10" : ""
      }`}
    >
      {isWinner && (
        <Trophy className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium truncate ${isWinner ? "text-emerald-400" : "text-white"}`}>
          {team.teamName || "Unnamed Team"}
        </p>
        {team.ownerName && (
          <p className="text-[10px] text-zinc-500 truncate">{team.ownerName}</p>
        )}
      </div>
      {team.wins !== undefined && (
        <span className="text-xs text-zinc-500 flex-shrink-0">
          {team.wins}-{team.losses}
        </span>
      )}
    </div>
  );
}

function formatFromLabel(from: { w?: number; l?: number }): string {
  if (from.w !== undefined) return `Winner of M${from.w}`;
  if (from.l !== undefined) return `Loser of M${from.l}`;
  return "TBD";
}

export function PlayoffBracket({
  winnersBracket,
  losersBracket,
  playoffTeams,
  showLosersBracket = false,
}: PlayoffBracketProps) {
  if (!winnersBracket || winnersBracket.length === 0) {
    return (
      <div className="text-center py-8">
        <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
        <p className="text-zinc-500">Playoff bracket not available yet</p>
        <p className="text-xs text-zinc-600 mt-1">
          The bracket will appear once playoffs begin
        </p>
      </div>
    );
  }

  // Group matchups by round
  const roundsMap = new Map<number, BracketMatchup[]>();
  winnersBracket.forEach((matchup) => {
    const round = matchup.round;
    if (!roundsMap.has(round)) {
      roundsMap.set(round, []);
    }
    roundsMap.get(round)!.push(matchup);
  });

  const rounds = Array.from(roundsMap.entries()).sort(([a], [b]) => a - b);

  // Find the championship game (highest round, placement === 1)
  const championship = winnersBracket.find((m) => m.placement === 1);

  return (
    <div className="space-y-6">
      {/* Championship Winner Banner */}
      {championship?.winner && (
        <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 rounded-xl p-6 border border-amber-500/30">
          <div className="flex items-center justify-center gap-4">
            <Crown className="w-10 h-10 text-amber-400" />
            <div className="text-center">
              <p className="text-sm text-amber-300 font-medium uppercase tracking-wider">
                League Champion
              </p>
              <p className="text-2xl font-bold text-white mt-1">
                {championship.winner.teamName || "Unnamed Team"}
              </p>
              {championship.winner.ownerName && (
                <p className="text-sm text-amber-200/70 mt-0.5">
                  {championship.winner.ownerName}
                </p>
              )}
            </div>
            <Crown className="w-10 h-10 text-amber-400" />
          </div>
        </div>
      )}

      {/* Winners Bracket */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Winners Bracket
        </h3>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-6 min-w-max">
            {rounds.map(([round, matchups]) => (
              <div key={round} className="space-y-3">
                <div className="text-xs font-medium text-zinc-500 text-center uppercase tracking-wider">
                  {round === rounds.length
                    ? "Championship"
                    : round === rounds.length - 1 && playoffTeams >= 4
                    ? "Semifinals"
                    : `Round ${round}`}
                </div>
                <div className="space-y-4 flex flex-col justify-center min-h-[200px]">
                  {matchups.map((matchup) => (
                    <MatchupCard
                      key={matchup.matchupId}
                      matchup={matchup}
                      showRound={false}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Consolation Bracket */}
      {showLosersBracket && losersBracket && losersBracket.length > 0 && (
        <div className="pt-6 border-t border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Medal className="w-4 h-4" />
            Consolation Bracket
          </h3>
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 flex-wrap">
              {losersBracket.map((matchup) => (
                <MatchupCard key={matchup.matchupId} matchup={matchup} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
