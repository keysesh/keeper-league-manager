import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";
import Link from "next/link";
import { ChevronRight, Lock, AlertTriangle, Trophy, Users, Target, Zap } from "lucide-react";
import { KeeperDeadlineCountdown } from "@/components/KeeperDeadlineCountdown";
import { SyncButton } from "@/components/SyncButton";

export default async function LeaguesPage() {
  const session = await getServerSession(authOptions);
  const currentSeason = getCurrentSeason();

  const [leagues, pendingProposals] = await Promise.all([
    session?.user?.id
      ? prisma.league.findMany({
          where: {
            season: currentSeason,
            rosters: {
              some: {
                teamMembers: {
                  some: { userId: session.user.id },
                },
              },
            },
          },
          include: {
            keeperSettings: true,
            _count: {
              select: {
                tradeProposals: {
                  where: { status: "PENDING" },
                },
              },
            },
          },
          orderBy: { name: "asc" },
        })
      : [],
    session?.user?.id
      ? prisma.tradeProposal.count({
          where: {
            status: "PENDING",
            parties: {
              some: {
                status: "PENDING",
                roster: {
                  teamMembers: {
                    some: { userId: session.user.id },
                  },
                },
              },
            },
          },
        })
      : 0,
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 md:space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-gray-500 text-xs sm:text-sm mb-0.5 sm:mb-1">Welcome back</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {session?.user?.name || session?.user?.username}
          </h1>
          <div className="flex items-center gap-2 mt-1.5 sm:mt-2">
            <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-md bg-blue-500/20 text-blue-400 text-xs sm:text-sm font-semibold border border-blue-500/30">
              {currentSeason} Season
            </span>
          </div>
        </div>
        <div className="self-start sm:self-auto">
          <KeeperDeadlineCountdown />
        </div>
      </div>

      {/* Pending Actions Alert */}
      {pendingProposals > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-amber-400 font-medium text-sm sm:text-base truncate sm:truncate-none">
              You have {pendingProposals} pending trade proposal{pendingProposals > 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href={leagues[0] ? `/league/${leagues[0].id}/trade-proposals` : "#"}
            className="text-xs sm:text-sm text-amber-400 hover:text-amber-300 active:text-amber-200 font-medium flex-shrink-0 px-2 py-1 rounded-md hover:bg-amber-500/10"
          >
            View
          </Link>
        </div>
      )}

      {/* Leagues Section */}
      <div>
        <h2 className="text-[10px] sm:text-xs font-semibold text-gray-500 mb-3 sm:mb-4 uppercase tracking-[0.15em] sm:tracking-[0.2em]">
          Your Leagues
        </h2>

        {leagues.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md p-8 sm:p-12 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-md bg-[#222222] border border-[#333333] flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-gray-500" />
            </div>
            <p className="text-gray-400 font-medium text-sm sm:text-base">No leagues found</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Join a league on Sleeper to get started</p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/league/${league.id}`}
                className="group relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-md p-3.5 sm:p-4 md:p-5 transition-all duration-200 hover:border-[#333333] hover:bg-[#222222] active:scale-[0.98]"
              >
                {/* Status badge */}
                <div className="flex items-center justify-between mb-2.5 sm:mb-3 md:mb-4">
                  <span
                    className={`text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md font-bold uppercase tracking-wide border ${
                      league.status === "IN_SEASON"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : league.status === "COMPLETE"
                        ? "bg-gray-700/50 text-gray-400 border-gray-600/30"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {league.status === "IN_SEASON" ? "Live" : league.status === "COMPLETE" ? "Done" : "Pre-Season"}
                  </span>
                  {league._count.tradeProposals > 0 && (
                    <span className="flex items-center justify-center px-1.5 sm:px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px] sm:text-[10px] font-bold">
                      {league._count.tradeProposals} pending
                    </span>
                  )}
                </div>

                {/* League info */}
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-md bg-[#222222] border border-[#333333] flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <h3 className="font-semibold text-white group-hover:text-blue-400 truncate transition-colors text-base sm:text-lg">
                      {league.name}
                    </h3>
                    <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1">
                      <span className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500">
                        <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        {league.totalRosters} teams
                      </span>
                      {league.keeperSettings && (
                        <span className="flex items-center gap-1 text-[10px] sm:text-xs text-amber-500/80">
                          <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          Keepers
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2">
                  <ChevronRight
                    className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {leagues.length > 0 && (
        <div>
          <h2 className="text-[10px] sm:text-xs font-semibold text-gray-500 mb-3 sm:mb-4 uppercase tracking-[0.15em] sm:tracking-[0.2em]">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <SyncButton />
            {leagues[0] && (
              <>
                <Link
                  href={`/league/${leagues[0].id}/draft-board`}
                  className="group flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 md:px-5 py-3 sm:py-3.5 md:py-4 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#333333] hover:bg-[#222222] transition-all duration-200 active:scale-[0.98]"
                >
                  <span className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-[#222222] border border-[#333333] flex-shrink-0">
                    <Target className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                  </span>
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-white block truncate group-hover:text-blue-400 transition-colors">Draft Board</span>
                    <span className="text-[10px] sm:text-xs text-gray-500 hidden xs:block">View keeper costs</span>
                  </div>
                </Link>
                <Link
                  href={`/league/${leagues[0].id}/trade-analyzer`}
                  className="group flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 md:px-5 py-3 sm:py-3.5 md:py-4 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#333333] hover:bg-[#222222] transition-all duration-200 active:scale-[0.98]"
                >
                  <span className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-[#222222] border border-[#333333] flex-shrink-0">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                  </span>
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-white block truncate group-hover:text-blue-400 transition-colors">Trade Analyzer</span>
                    <span className="text-[10px] sm:text-xs text-gray-500 hidden xs:block">Analyze trades</span>
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
