import { prisma } from "@/lib/prisma";
import Link from "next/link";

async function getLeagues() {
  const leagues = await prisma.league.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      sleeperId: true,
      season: true,
      status: true,
      totalRosters: true,
      updatedAt: true,
      _count: {
        select: { rosters: true },
      },
      rosters: {
        select: {
          _count: {
            select: { keepers: true },
          },
        },
      },
    },
  });

  return leagues.map((league) => ({
    ...league,
    keeperCount: league.rosters.reduce((sum, r) => sum + r._count.keepers, 0),
  }));
}

export default async function AdminLeaguesPage() {
  const leagues = await getLeagues();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">League Management</h1>
        <div className="text-gray-400">{leagues.length} leagues</div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 text-gray-400 font-medium">League</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Season</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Teams</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Keepers</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Status</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Last Updated</th>
              <th className="px-4 py-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leagues.map((league) => (
              <tr key={league.id} className="border-b border-gray-800 hover:bg-gray-850">
                <td className="px-4 py-3">
                  <div>
                    <div className="text-white font-medium">{league.name}</div>
                    <div className="text-xs text-gray-500">{league.sleeperId}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400">{league.season}</td>
                <td className="px-4 py-3 text-gray-400">
                  {league._count.rosters}/{league.totalRosters}
                </td>
                <td className="px-4 py-3 text-gray-400">{league.keeperCount}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      league.status === "IN_SEASON"
                        ? "bg-green-500/20 text-green-400"
                        : league.status === "PRE_DRAFT"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {league.status?.replace("_", " ").toLowerCase() || "Unknown"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {new Date(league.updatedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/league/${league.id}`}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
