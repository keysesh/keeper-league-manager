import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SleeperClient } from "@/lib/sleeper/client";
import { getCurrentSeason, getKeeperDeadlineInfo } from "@/lib/constants/keeper-rules";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const currentSeason = getCurrentSeason();
  const deadlineInfo = getKeeperDeadlineInfo();

  // Fetch user's leagues from Sleeper
  const sleeper = new SleeperClient();
  const leagues = session?.user?.sleeperId
    ? await sleeper.getUserLeagues(session.user.sleeperId, currentSeason)
    : [];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Welcome back, {session?.user?.name || session?.user?.username}!
        </h1>
        <p className="text-gray-400 mt-2">
          Manage your keeper leagues for the {currentSeason} season
        </p>
      </div>

      {/* Status Banner */}
      <div
        className={`mb-8 p-4 rounded-lg border ${
          deadlineInfo.isActive
            ? "bg-green-500/10 border-green-500/20"
            : "bg-yellow-500/10 border-yellow-500/20"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{deadlineInfo.isActive ? "✅" : "⏰"}</span>
          <div>
            <p
              className={`font-medium ${
                deadlineInfo.isActive ? "text-green-400" : "text-yellow-400"
              }`}
            >
              {deadlineInfo.message}
            </p>
            <p className="text-sm text-gray-400 mt-0.5">
              {deadlineInfo.isActive
                ? "Select your keepers before the draft begins"
                : "Keeper selections are locked during the season"}
            </p>
          </div>
        </div>
      </div>

      {/* Leagues Grid */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Your Leagues</h2>
      </div>

      {leagues.length === 0 ? (
        <div className="bg-gray-800/50 rounded-xl p-8 text-center">
          <p className="text-gray-400">No leagues found for {currentSeason}</p>
          <p className="text-sm text-gray-500 mt-2">
            Join a league on Sleeper to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leagues.map((league) => (
            <Link
              key={league.league_id}
              href={`/league/${league.league_id}`}
              className="group bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-purple-500/50 rounded-xl p-6 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors">
                    {league.name}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {league.total_rosters} teams
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    league.status === "in_season"
                      ? "bg-green-500/20 text-green-400"
                      : league.status === "complete"
                      ? "bg-gray-500/20 text-gray-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}
                >
                  {league.status === "in_season"
                    ? "Active"
                    : league.status === "complete"
                    ? "Complete"
                    : "Pre-Draft"}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                <span>Season {league.season}</span>
                {league.settings.type === 1 && (
                  <span className="text-purple-400">Keeper</span>
                )}
                {league.settings.type === 2 && (
                  <span className="text-blue-400">Dynasty</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <button className="bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl p-6 text-left transition-all group">
            <span className="text-2xl">🔄</span>
            <h3 className="font-medium text-white mt-3 group-hover:text-purple-400 transition-colors">
              Sync Data
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Refresh rosters from Sleeper
            </p>
          </button>

          <button className="bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl p-6 text-left transition-all group">
            <span className="text-2xl">📊</span>
            <h3 className="font-medium text-white mt-3 group-hover:text-purple-400 transition-colors">
              Draft Board
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              View keeper assignments
            </p>
          </button>

          <button className="bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl p-6 text-left transition-all group">
            <span className="text-2xl">⚙️</span>
            <h3 className="font-medium text-white mt-3 group-hover:text-purple-400 transition-colors">
              Settings
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Configure keeper rules
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
