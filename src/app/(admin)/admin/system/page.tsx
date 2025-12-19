import { prisma } from "@/lib/prisma";

async function getSystemStats() {
  const [playerCount, userCount, leagueCount, keeperCount, rosterCount] = await Promise.all([
    prisma.player.count(),
    prisma.user.count(),
    prisma.league.count(),
    prisma.keeper.count(),
    prisma.roster.count(),
  ]);

  const rookieCount = await prisma.player.count({
    where: { yearsExp: 0 },
  });

  return {
    playerCount,
    userCount,
    leagueCount,
    keeperCount,
    rosterCount,
    rookieCount,
  };
}

async function checkSleeperAPI() {
  try {
    const res = await fetch("https://api.sleeper.app/v1/players/nfl", { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function AdminSystemPage() {
  const stats = await getSystemStats();
  const sleeperOk = await checkSleeperAPI();

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">System Health</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Service Status</h2>
          <div className="space-y-3">
            <StatusRow label="Database" status="Connected" ok />
            <StatusRow label="Sleeper API" status={sleeperOk ? "Available" : "Unavailable"} ok={sleeperOk} />
            <StatusRow label="Authentication" status="Active" ok />
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Database Stats</h2>
          <div className="space-y-3">
            <StatRow label="Total Players" value={stats.playerCount.toLocaleString()} />
            <StatRow label="Rookies (0 exp)" value={stats.rookieCount.toLocaleString()} />
            <StatRow label="Users" value={stats.userCount.toLocaleString()} />
            <StatRow label="Leagues" value={stats.leagueCount.toLocaleString()} />
            <StatRow label="Rosters" value={stats.rosterCount.toLocaleString()} />
            <StatRow label="Keepers" value={stats.keeperCount.toLocaleString()} />
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Environment</h2>
        <div className="space-y-2 font-mono text-sm">
          <div className="flex">
            <span className="text-gray-500 w-40">NODE_ENV</span>
            <span className="text-green-400">{process.env.NODE_ENV}</span>
          </div>
          <div className="flex">
            <span className="text-gray-500 w-40">Database</span>
            <span className="text-green-400">PostgreSQL (Railway)</span>
          </div>
          <div className="flex">
            <span className="text-gray-500 w-40">Runtime</span>
            <span className="text-green-400">Next.js Edge/Node</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, status, ok }: { label: string; status: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <span className="text-gray-400">{label}</span>
      <span className={`flex items-center gap-2 ${ok ? "text-green-400" : "text-red-400"}`}>
        <span className={`w-2 h-2 rounded-full ${ok ? "bg-green-400" : "bg-red-400"}`} />
        {status}
      </span>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}
