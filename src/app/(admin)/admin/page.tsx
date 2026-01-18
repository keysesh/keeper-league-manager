import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Users,
  Trophy,
  Star,
  RefreshCw,
  Activity,
  UserCircle,
  ArrowUpRight,
} from "lucide-react";
import { FootballIcon } from "@/components/ui/Icons";

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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Admin Dashboard</h1>
        <p className="text-gray-400 mt-1">System overview and quick actions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Players"
          value={stats.playerCount.toLocaleString()}
          icon={<FootballIcon size={20} />}
          href="/admin/players"
          color="blue"
        />
        <StatCard
          title="Users"
          value={stats.userCount.toLocaleString()}
          icon={<Users size={20} strokeWidth={2} />}
          href="/admin/users"
          color="emerald"
        />
        <StatCard
          title="Leagues"
          value={stats.leagueCount.toLocaleString()}
          icon={<Trophy size={20} strokeWidth={2} />}
          href="/admin/leagues"
          color="violet"
        />
        <StatCard
          title="Keepers"
          value={stats.keeperCount.toLocaleString()}
          icon={<Star size={20} strokeWidth={2} />}
          href="#"
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-b from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
            Quick Actions
          </h2>
          <div className="space-y-2">
            <ActionButton
              href="/admin/players"
              label="Sync Players from Sleeper"
              icon={<RefreshCw size={18} strokeWidth={2} />}
            />
            <ActionButton
              href="/admin/system"
              label="View System Health"
              icon={<Activity size={18} strokeWidth={2} />}
            />
            <ActionButton
              href="/admin/users"
              label="Manage Users"
              icon={<UserCircle size={18} strokeWidth={2} />}
            />
          </div>
        </div>

        <div className="bg-gradient-to-b from-slate-800/50 to-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white mb-5">System Status</h2>
          <div className="space-y-1">
            <StatusRow label="Database" status="Connected" ok />
            <StatusRow label="Sleeper API" status="Available" ok />
            <StatusRow label="Last Player Sync" status="--" ok />
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
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  href: string;
  color: "blue" | "emerald" | "violet" | "purple";
}) {
  const colorClasses = {
    blue: "from-blue-500/20 to-blue-500/5 border-blue-500/20 hover:border-blue-500/40",
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40",
    violet: "from-violet-500/20 to-violet-500/5 border-violet-500/20 hover:border-violet-500/40",
    purple: "from-purple-500/20 to-purple-500/5 border-purple-500/20 hover:border-purple-500/40",
  };

  const iconClasses = {
    blue: "bg-blue-500/20 text-blue-400",
    emerald: "bg-emerald-500/20 text-emerald-400",
    violet: "bg-violet-500/20 text-violet-400",
    purple: "bg-purple-500/20 text-purple-400",
  };

  return (
    <Link
      href={href}
      className={`group relative bg-gradient-to-b ${colorClasses[color]} rounded-2xl p-6 border transition-all duration-200 hover:scale-[1.02]`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className={`flex items-center justify-center w-10 h-10 rounded-xl ${iconClasses[color]}`}>
          {icon}
        </span>
        <ArrowUpRight size={16} className="text-gray-500 group-hover:text-white transition-colors" />
      </div>
      <div className="text-3xl font-bold text-white mb-1 tracking-tight">{value}</div>
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
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-4 py-3.5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600/50 rounded-xl transition-all duration-150 text-white"
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-700/50 text-slate-400 group-hover:text-white transition-colors">
        {icon}
      </span>
      <span className="text-sm font-medium">{label}</span>
      <ArrowUpRight size={14} className="ml-auto text-gray-500 group-hover:text-white transition-colors" />
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
    <div className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`flex items-center gap-2.5 text-sm font-medium ${ok ? "text-emerald-400" : "text-red-400"}`}>
        <span className="relative flex h-2 w-2">
          {ok && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
        </span>
        {status}
      </span>
    </div>
  );
}
