"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  LayoutDashboard,
  LayoutGrid,
  ArrowLeftRight,
  Users,
  Settings,
  type LucideIcon,
  Home,
  ChevronLeft,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const leagueId = params?.leagueId as string | undefined;

  const isLeaguePage = pathname.includes("/league/") && leagueId;

  const dashboardNav: NavItem[] = [
    { name: "My Leagues", href: "/leagues", icon: LayoutDashboard },
  ];

  const leagueNav: NavItem[] = leagueId
    ? [
        { name: "Overview", href: `/league/${leagueId}`, icon: Home },
        { name: "Draft Board", href: `/league/${leagueId}/draft-board`, icon: LayoutGrid },
        { name: "Trades", href: `/league/${leagueId}/trade-analyzer`, icon: ArrowLeftRight },
        { name: "Teams", href: `/league/${leagueId}/team`, icon: Users },
        { name: "Settings", href: `/league/${leagueId}/settings`, icon: Settings },
      ]
    : [];

  const navigation = isLeaguePage ? leagueNav : dashboardNav;

  return (
    <aside
      className="hidden lg:flex lg:flex-col lg:w-72 lg:border-r lg:border-white/[0.06] bg-[#0c0a0f]/80 backdrop-blur-xl min-h-[calc(100vh-4rem)]"
      aria-label="Main navigation"
    >
      {/* Back to Leagues when in league view */}
      {isLeaguePage && (
        <div className="px-5 pt-6">
          <Link
            href="/leagues"
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-violet-400 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            All Leagues
          </Link>
        </div>
      )}

      <nav className="flex-1 px-5 py-6 space-y-1.5" role="navigation">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href) && !navigation.some(n => n.href !== item.href && n.href.length > item.href.length && pathname.startsWith(n.href)));

          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`
                group flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium
                transition-all duration-300 ease-out
                focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70
                ${isActive
                  ? "bg-gradient-to-r from-violet-500/15 via-violet-500/10 to-transparent text-violet-400 border border-violet-500/20"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03] border border-transparent"
                }
              `}
            >
              <span
                className={`
                flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300
                ${isActive
                  ? "bg-violet-500/20 text-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                  : "bg-white/[0.03] text-zinc-500 group-hover:bg-white/[0.06] group-hover:text-zinc-300"
                }
              `}
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="tracking-wide flex-1">{item.name}</span>
              {item.badge && item.badge > 0 && (
                <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 text-xs font-semibold rounded-full">
                  {item.badge}
                </span>
              )}
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Season Card */}
      <div className="mx-5 mb-6">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent border border-white/[0.06] backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-semibold">
              Current Season
            </span>
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-3xl font-bold text-white tracking-tight">{new Date().getFullYear()}</p>
          <p className="text-xs text-violet-400/90 mt-2 font-medium">Keeper selections open</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-5 border-t border-white/[0.04]">
        <p className="text-[11px] text-zinc-500 font-medium tracking-wide">
          E Pluribus Fantasy Football
        </p>
        <p className="text-[10px] text-zinc-600 mt-1 font-medium">
          Keeper Tracker v2.0
        </p>
      </div>
    </aside>
  );
}
