import { prisma } from "@/lib/prisma";
import Link from "next/link";

async function getStats() {
  const [playerCount, userCount, leagueCount, keeperCount] = await Promise.all([
    prisma.player.count(),
    prisma.user.count(),
    prisma.league.count(),
    prisma.keeper.count(),
  ]);

  return { playerCount, userCount, leagueCount, keeperCount };
}

export default async function AdminDashboard() {
  const stats = await getStats();

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Players"
          value={stats.playerCount.toLocaleString()}
          icon="🏈"
          href="/admin/players"
        />
        <StatCard
          title="Users"
          value={stats.userCount.toLocaleString()}
          icon="👥"
          href="/admin/users"
        />
        <StatCard
          title="Leagues"
          value={stats.leagueCount.toLocaleString()}
          icon="🏆"
          href="/admin/leagues"
        />
        <StatCard
          title="Keepers"
          value={stats.keeperCount.toLocaleString()}
          icon="⭐"
          href="#"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <ActionButton href="/admin/players" label="Sync Players from Sleeper" icon="🔄" />
            <ActionButton href="/admin/system" label="View System Health" icon="💚" />
            <ActionButton href="/admin/users" label="Manage Users" icon="👤" />
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">System Status</h2>
          <div className="space-y-3">
            <StatusRow label="Database" status="Connected" ok />
            <StatusRow label="Sleeper API" status="Available" ok />
            <StatusRow label="Last Player Sync" status="—" ok />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  href,
}: {
  title: string;
  value: string;
  icon: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-gray-900 rounded-lg p-6 border border-gray-800 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-gray-400">{title}</div>
    </Link>
  );
}

function ActionButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-750 rounded-lg transition-colors text-white"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function StatusRow({
  label,
  status,
  ok,
}: {
  label: string;
  status: string;
  ok: boolean;
}) {
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
