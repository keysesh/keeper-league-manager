import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason, getKeeperDeadlineInfo } from "@/lib/constants/keeper-rules";
import Link from "next/link";
import { LayoutGrid, ArrowLeftRight, ChevronRight, Lock, AlertTriangle } from "lucide-react";
import { KeeperDeadlineCountdown } from "@/components/KeeperDeadlineCountdown";
import { SyncButton } from "@/components/SyncButton";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const currentSeason = getCurrentSeason();
  const deadlineInfo = getKeeperDeadlineInfo();

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
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome, {session?.user?.name || session?.user?.username}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {currentSeason} Season
          </p>
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
          <div className="rounded-2xl p-8 text-center bg-gray-800/30 border border-gray-700/50">
            <p className="text-gray-400 text-sm">No leagues found</p>
            <p className="text-xs text-gray-600 mt-1">Join a league on Sleeper</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/league/${league.id}`}
                className="group relative bg-gradient-to-b from-gray-800/50 to-gray-900/50 rounded-2xl p-5 border border-gray-700/40 hover:border-amber-500/30 transition-all duration-200 hover:scale-[1.02]"
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold uppercase tracking-wide ${
                      league.status === "IN_SEASON"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : league.status === "COMPLETE"
                        ? "bg-gray-700/50 text-gray-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {league.status === "IN_SEASON" ? "Live" : league.status === "COMPLETE" ? "Done" : "Pre"}
                  </span>
                  {league.keeperSettings && (
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500/20">
                      <Lock size={12} className="text-amber-400" />
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-white group-hover:text-amber-400 truncate transition-colors">
                  {league.name}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {league.totalRosters} teams
                </p>
                <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 group-hover:text-amber-400 transition-colors" />
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
          <div className="flex flex-wrap gap-3">
            <QuickSyncButton />
            {leagues[0] && (
              <>
                <Link
                  href={`/league/${leagues[0].id}/draft-board`}
                  className="group flex items-center gap-3 px-5 py-3 rounded-xl border border-gray-700/50 bg-gray-800/30 transition-all duration-150 hover:border-amber-500/30 hover:bg-amber-500/5"
                >
                  <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400">
                    <LayoutGrid size={18} strokeWidth={2} />
                  </span>
                  <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">Draft Board</span>
                </Link>
                <Link
                  href={`/league/${leagues[0].id}/trade-analyzer`}
                  className="group flex items-center gap-3 px-5 py-3 rounded-xl border border-gray-700/50 bg-gray-800/30 transition-all duration-150 hover:border-emerald-500/30 hover:bg-emerald-500/5"
                >
                  <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <ArrowLeftRight size={18} strokeWidth={2} />
                  </span>
                  <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">Trade Analyzer</span>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickSyncButton() {
  return <SyncButton />;
}
