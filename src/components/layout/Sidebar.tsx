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
  UserCircle,
  History,
  Activity,
  FileText,
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
    { name: "My Profile", href: "/profile", icon: UserCircle },
    ...(isAdmin ? [{ name: "Admin Panel", href: "/admin", icon: Shield }] : []),
  ];

  const leagueNav: NavItem[] = leagueId
    ? [
        { name: "Overview", href: `/league/${leagueId}`, icon: Home },
        { name: "My Team", href: `/league/${leagueId}/my-team`, icon: UserCircle },
        { name: "Draft Board", href: `/league/${leagueId}/draft-board`, icon: LayoutGrid },
        { name: "Trades", href: `/league/${leagueId}/trade-analyzer`, icon: ArrowLeftRight },
        { name: "Trade Proposals", href: `/league/${leagueId}/trade-proposals`, icon: FileText },
        { name: "All Teams", href: `/league/${leagueId}/team`, icon: Users },
        { name: "League History", href: `/league/${leagueId}/history`, icon: History },
        { name: "Activity", href: `/league/${leagueId}/activity`, icon: Activity },
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
          // Improved active state logic for nested routes
          let isActive = pathname === item.href;

          if (!isActive && item.href !== "/") {
            // Check if pathname starts with item.href
            if (pathname.startsWith(item.href)) {
              // Special case: /team route should only match exact or when followed by nothing after /team
              // Don't match /team/[rosterId] for the "All Teams" link
              if (item.href.endsWith("/team")) {
                // Only match if we're exactly on /team or /team/ (no specific team ID)
                isActive = pathname === item.href || pathname === item.href + "/";
              } else {
                // For other routes, use prefix matching but check no other longer nav item matches
                isActive = !navigation.some(n =>
                  n.href !== item.href &&
                  n.href.length > item.href.length &&
                  pathname.startsWith(n.href)
                );
              }
            }
          }

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

      {/* Footer */}
      <div className="mt-auto px-4 py-4 border-t border-[#1a1a1a]">
        <p className="text-xs text-gray-500">{new Date().getFullYear()} Season</p>
      </div>
    </aside>
  );
}
