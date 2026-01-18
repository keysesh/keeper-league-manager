import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason } from "@/lib/constants/keeper-rules";
import Link from "next/link";
import { ChevronRight, Lock, AlertTriangle } from "lucide-react";
import {
  TrophyIcon,
  UsersIcon,
  TargetIcon,
  LightningIcon,
  IconGradientDefs,
} from "@/components/ui/PremiumIcons";
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
    <>
    <IconGradientDefs />
    <div className="max-w-6xl mx-auto space-y-8 p-4 md:p-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-gray-500 text-sm mb-1">Welcome back</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {session?.user?.name || session?.user?.username}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-3 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-semibold">
              {currentSeason} Season
            </span>
          </div>
        </div>
        <KeeperDeadlineCountdown />
      </div>

      {/* Pending Actions Alert */}
      {pendingProposals > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-amber-400 font-medium">
              You have {pendingProposals} pending trade proposal{pendingProposals > 1 ? "s" : ""} to review
            </p>
          </div>
          <Link
            href={leagues[0] ? `/league/${leagues[0].id}/trade-proposals` : "#"}
            className="text-sm text-amber-400 hover:text-amber-300 font-medium"
          >
            View
          </Link>
        </div>
      )}

      {/* Leagues Section */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-[0.2em]">
          Your Leagues
        </h2>

        {leagues.length === 0 ? (
          <div className="card-premium rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
              <TrophyIcon size={32} />
            </div>
            <p className="text-gray-400 font-medium">No leagues found</p>
            <p className="text-sm text-gray-600 mt-1">Join a league on Sleeper to get started</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/league/${league.id}`}
                className="group relative card-premium rounded-2xl p-5 transition-all duration-300"
              >
                {/* Status badge */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wide ${
                      league.status === "IN_SEASON"
                        ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                        : league.status === "COMPLETE"
                        ? "bg-gray-700/50 text-gray-400 ring-1 ring-gray-600/30"
                        : "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                    }`}
                  >
                    {league.status === "IN_SEASON" ? "Live" : league.status === "COMPLETE" ? "Done" : "Pre-Season"}
                  </span>
                  {league._count.tradeProposals > 0 && (
                    <span className="flex items-center justify-center px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                      {league._count.tradeProposals} pending
                    </span>
                  )}
                </div>

                {/* League info */}
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-600/10 ring-1 ring-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <TrophyIcon size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white group-hover:text-violet-400 truncate transition-colors text-lg">
                      {league.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <UsersIcon size={12} />
                        {league.totalRosters} teams
                      </span>
                      {league.keeperSettings && (
                        <span className="flex items-center gap-1 text-xs text-amber-500/80">
                          <Lock size={10} />
                          Keepers
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <ChevronRight
                    size={20}
                    className="text-gray-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all"
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
          <h2 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-[0.2em]">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SyncButton />
            {leagues[0] && (
              <>
                <Link
                  href={`/league/${leagues[0].id}/draft-board`}
                  className="group flex items-center gap-3 px-5 py-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-white/[0.06] hover:border-violet-500/30 transition-all duration-300 hover:scale-[1.02]"
                >
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/20 ring-1 ring-violet-500/20">
                    <TargetIcon size={20} />
                  </span>
                  <div>
                    <span className="text-sm font-semibold text-white block">Draft Board</span>
                    <span className="text-xs text-gray-500">View keeper costs</span>
                  </div>
                </Link>
                <Link
                  href={`/league/${leagues[0].id}/trade-analyzer`}
                  className="group flex items-center gap-3 px-5 py-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-white/[0.06] hover:border-emerald-500/30 transition-all duration-300 hover:scale-[1.02]"
                >
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/20">
                    <LightningIcon size={20} />
                  </span>
                  <div>
                    <span className="text-sm font-semibold text-white block">Trade Analyzer</span>
                    <span className="text-xs text-gray-500">Analyze trades</span>
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
