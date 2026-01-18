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
  Shield,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const leagueId = params?.leagueId as string | undefined;

  const isLeaguePage = pathname.includes("/league/") && leagueId;

  const dashboardNav: NavItem[] = [
    { name: "My Leagues", href: "/leagues", icon: LayoutDashboard },
    ...(isAdmin ? [{ name: "Admin Panel", href: "/admin", icon: Shield }] : []),
  ];

  const leagueNav: NavItem[] = leagueId
    ? [
        { name: "Overview", href: `/league/${leagueId}`, icon: Home },
        { name: "Draft Board", href: `/league/${leagueId}/draft-board`, icon: LayoutGrid },
        { name: "Trades", href: `/league/${leagueId}/trade-analyzer`, icon: ArrowLeftRight },
        { name: "Teams", href: `/league/${leagueId}/team`, icon: Users },
        { name: "Settings", href: `/league/${leagueId}/settings`, icon: Settings },
        ...(isAdmin ? [{ name: "Admin Panel", href: "/admin", icon: Shield }] : []),
      ]
    : [];

  const navigation = isLeaguePage ? leagueNav : dashboardNav;

  return (
    <aside
      className="hidden lg:flex lg:flex-col lg:w-60 xl:w-64 lg:border-r lg:border-[#2a2a2a] bg-[#0d0d0d] min-h-[calc(100vh-4rem)]"
      aria-label="Main navigation"
    >
      {/* Back to Leagues when in league view */}
      {isLeaguePage && (
        <div className="px-4 pt-5">
          <Link
            href="/leagues"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-400 transition-colors px-2 py-1.5 -ml-2 rounded-md hover:bg-[#1a1a1a]"
          >
            <ChevronLeft className="w-4 h-4" />
            All Leagues
          </Link>
        </div>
      )}

      <nav className="flex-1 px-4 py-5 space-y-1" role="navigation">
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
                group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium
                transition-all duration-200 ease-out
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50
                ${isActive
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : "text-gray-400 hover:text-white hover:bg-[#1a1a1a] border border-transparent"
                }
              `}
            >
              <span
                className={`
                flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200
                ${isActive
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-[#1a1a1a] text-gray-500 group-hover:bg-[#222222] group-hover:text-gray-300"
                }
              `}
              >
                <Icon size={17} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="flex-1">{item.name}</span>
              {item.badge && item.badge > 0 && (
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded-full">
                  {item.badge}
                </span>
              )}
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Season Card */}
      <div className="mx-4 mb-5">
        <div className="p-4 rounded-md bg-[#1a1a1a] border border-[#2a2a2a]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">
              Season
            </span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <p className="text-2xl font-bold text-white tracking-tight">{new Date().getFullYear()}</p>
          <p className="text-[11px] text-gray-400 mt-1.5 font-medium">Keepers open</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[#2a2a2a]">
        <p className="text-[10px] text-gray-500 font-medium">
          E Pluribus Fantasy Football
        </p>
        <p className="text-[9px] text-gray-600 mt-0.5">
          Keeper Tracker v2.0
        </p>
      </div>
    </aside>
  );
}
