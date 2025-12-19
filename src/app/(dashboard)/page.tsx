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
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">
          Welcome back, {session?.user?.name || session?.user?.username}!
        </h1>
        <p className="text-gray-500 mt-2 text-lg">
          Manage your keeper leagues for the <span className="text-purple-400 font-semibold">{currentSeason}</span> season
        </p>
      </div>

      {/* Status Banner */}
      <div
        className={`p-5 rounded-2xl border backdrop-blur-sm ${
          deadlineInfo.isActive
            ? "bg-gradient-to-r from-green-500/10 to-green-500/5 border-green-500/20"
            : "bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-amber-500/20"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            deadlineInfo.isActive
              ? "bg-green-500/20"
              : "bg-amber-500/20"
          }`}>
            <span className="text-2xl">{deadlineInfo.isActive ? "✅" : "⏰"}</span>
          </div>
          <div>
            <p
              className={`font-bold text-lg ${
                deadlineInfo.isActive ? "text-green-400" : "text-amber-400"
              }`}
            >
              {deadlineInfo.message}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {deadlineInfo.isActive
                ? "Select your keepers before the draft begins"
                : "Keeper selections are locked during the season"}
            </p>
          </div>
        </div>
      </div>

      {/* Leagues Section */}
      <div>
        <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
          <span className="w-1 h-5 bg-purple-500 rounded-full"></span>
          Your Leagues
        </h2>

        {leagues.length === 0 ? (
          <div className="card-premium rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🏈</span>
            </div>
            <p className="text-gray-400 font-medium">No leagues found for {currentSeason}</p>
            <p className="text-sm text-gray-600 mt-2">
              Join a league on Sleeper to get started
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/league/${league.id}`}
                className="group card-premium rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-white group-hover:text-purple-400 transition-colors">
                      {league.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {league.totalRosters} teams
                    </p>
                  </div>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-bold ${
                      league.status === "IN_SEASON"
                        ? "bg-green-500/20 text-green-400"
                        : league.status === "COMPLETE"
                        ? "bg-gray-700 text-gray-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {league.status === "IN_SEASON"
                      ? "Active"
                      : league.status === "COMPLETE"
                      ? "Complete"
                      : "Pre-Draft"}
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
                  <span className="text-sm text-gray-600">Season {league.season}</span>
                  {league.keeperSettings && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold">
                      Keeper
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
          <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
          Quick Actions
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <button className="card-premium rounded-2xl p-6 text-left transition-all duration-300 group hover:scale-[1.02]">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/30 transition-colors">
              <span className="text-2xl">🔄</span>
            </div>
            <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors">
              Sync Data
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Refresh rosters from Sleeper
            </p>
          </button>

          <button className="card-premium rounded-2xl p-6 text-left transition-all duration-300 group hover:scale-[1.02]">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/30 transition-colors">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="font-bold text-white group-hover:text-purple-400 transition-colors">
              Draft Board
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              View keeper assignments
            </p>
          </button>

          <button className="card-premium rounded-2xl p-6 text-left transition-all duration-300 group hover:scale-[1.02]">
            <div className="w-12 h-12 rounded-xl bg-gray-700/50 flex items-center justify-center mb-4 group-hover:bg-gray-700 transition-colors">
              <span className="text-2xl">⚙️</span>
            </div>
            <h3 className="font-bold text-white group-hover:text-gray-300 transition-colors">
              Settings
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Configure keeper rules
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
