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
          color="violet"
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
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-b from-[#1A1425]/80 to-[#0F0B1A]/80 rounded-2xl p-6 border border-violet-500/20">
          <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
            <span className="text-violet-400">Quick Actions</span>
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

        <div className="bg-gradient-to-b from-[#1A1425]/80 to-[#0F0B1A]/80 rounded-2xl p-6 border border-violet-500/20">
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
  color: "violet" | "emerald" | "amber";
}) {
  const colorClasses = {
    violet: "from-violet-500/20 to-violet-500/5 border-violet-500/20 hover:border-violet-500/40 hover:shadow-violet-500/10",
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-emerald-500/10",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/20 hover:border-amber-500/40 hover:shadow-amber-500/10",
  };

  const iconClasses = {
    violet: "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30",
    emerald: "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30",
    amber: "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30",
  };

  return (
    <Link
      href={href}
      className={`group relative bg-gradient-to-b ${colorClasses[color]} rounded-2xl p-6 border transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}
    >
      <div className="flex items-center justify-between mb-4">
        <span className={`flex items-center justify-center w-10 h-10 rounded-xl ${iconClasses[color]}`}>
          {icon}
        </span>
        <ArrowUpRight size={16} className="text-gray-500 group-hover:text-violet-400 transition-colors" />
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
      className="group flex items-center gap-3 px-4 py-3.5 bg-[#0F0B1A]/50 hover:bg-violet-500/10 border border-violet-500/10 hover:border-violet-500/30 rounded-xl transition-all duration-200 text-white"
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-500/10 text-violet-400 group-hover:text-violet-300 transition-colors ring-1 ring-violet-500/20">
        {icon}
      </span>
      <span className="text-sm font-medium group-hover:text-violet-300 transition-colors">{label}</span>
      <ArrowUpRight size={14} className="ml-auto text-gray-500 group-hover:text-violet-400 transition-colors" />
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
    <div className="flex items-center justify-between py-3 border-b border-violet-500/10 last:border-0">
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
