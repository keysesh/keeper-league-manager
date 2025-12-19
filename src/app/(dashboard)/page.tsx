import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason, getKeeperDeadlineInfo } from "@/lib/constants/keeper-rules";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const currentSeason = getCurrentSeason();
  const deadlineInfo = getKeeperDeadlineInfo();

  // Fetch user's leagues from database (synced from Sleeper)
  const leagues = session?.user?.id
    ? await prisma.league.findMany({
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
        },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome Header - Compact */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome, {session?.user?.name || session?.user?.username}
          </h1>
          <p className="text-gray-500 text-sm">
            {currentSeason} Season
          </p>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
            deadlineInfo.isActive
              ? "bg-green-500/15 text-green-400"
              : "bg-amber-500/15 text-amber-400"
          }`}
        >
          <span>{deadlineInfo.isActive ? "✓" : "⏳"}</span>
          <span>{deadlineInfo.isActive ? "Keepers Open" : "Locked"}</span>
        </div>
      </div>

      {/* Leagues Section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
          Your Leagues
        </h2>

        {leagues.length === 0 ? (
          <div className="card-compact rounded-xl p-6 text-center">
            <p className="text-gray-400 text-sm">No leagues found</p>
            <p className="text-xs text-gray-600 mt-1">Join a league on Sleeper</p>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/league/${league.id}`}
                className="group card-compact rounded-xl p-3 hover:border-purple-500/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      league.status === "IN_SEASON"
                        ? "bg-green-500/20 text-green-400"
                        : league.status === "COMPLETE"
                        ? "bg-gray-700 text-gray-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {league.status === "IN_SEASON" ? "Live" : league.status === "COMPLETE" ? "Done" : "Pre"}
                  </span>
                  {league.keeperSettings && (
                    <span className="text-[10px] text-purple-400">K</span>
                  )}
                </div>
                <h3 className="font-semibold text-sm text-white group-hover:text-purple-400 truncate">
                  {league.name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {league.totalRosters} teams
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions - Compact Row */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
          Quick Actions
        </h2>
        <div className="flex gap-2">
          <button className="card-compact rounded-lg px-4 py-2.5 flex items-center gap-2 group hover:border-blue-500/30">
            <span className="text-lg">🔄</span>
            <span className="text-sm font-medium text-gray-300 group-hover:text-blue-400">Sync</span>
          </button>
          <button className="card-compact rounded-lg px-4 py-2.5 flex items-center gap-2 group hover:border-purple-500/30">
            <span className="text-lg">📊</span>
            <span className="text-sm font-medium text-gray-300 group-hover:text-purple-400">Draft Board</span>
          </button>
          <button className="card-compact rounded-lg px-4 py-2.5 flex items-center gap-2 group hover:border-gray-500/30">
            <span className="text-lg">⚙️</span>
            <span className="text-sm font-medium text-gray-300 group-hover:text-gray-200">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
