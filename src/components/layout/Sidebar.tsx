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
  Trophy,
  TrendingUp,
  Dices,
  BarChart3,
  Bookmark,
} from "lucide-react";
import { cn } from "@/lib/design-tokens";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const leagueId = params?.leagueId as string | undefined;

  const isLeaguePage = pathname.includes("/league/") && leagueId;

  // Dashboard navigation (when not in a league)
  const dashboardSections: NavSection[] = [
    {
      title: "Overview",
      items: [
        { name: "My Leagues", href: "/leagues", icon: LayoutDashboard },
        { name: "My Profile", href: "/profile", icon: UserCircle },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: "Admin",
            items: [{ name: "Admin Panel", href: "/admin", icon: Shield }],
          },
        ]
      : []),
  ];

  // League navigation (when inside a league)
  const leagueSections: NavSection[] = leagueId
    ? [
        {
          title: "Overview",
          items: [{ name: "Dashboard", href: `/league/${leagueId}`, icon: Home }],
        },
        {
          title: "My Team",
          items: [
            { name: "Roster", href: `/league/${leagueId}/my-team`, icon: UserCircle },
            { name: "Keepers", href: `/league/${leagueId}/my-team#keepers`, icon: Bookmark },
          ],
        },
        {
          title: "League",
          items: [
            { name: "Standings", href: `/league/${leagueId}/standings`, icon: BarChart3 },
            { name: "Power Rankings", href: `/league/${leagueId}/power-rankings`, icon: TrendingUp },
            { name: "Luck Factor", href: `/league/${leagueId}/luck`, icon: Dices },
            { name: "All Teams", href: `/league/${leagueId}/team`, icon: Users },
          ],
        },
        {
          title: "Activity",
          items: [
            { name: "Trade Center", href: `/league/${leagueId}/trade-analyzer`, icon: ArrowLeftRight },
            { name: "Trade Proposals", href: `/league/${leagueId}/trade-proposals`, icon: FileText },
            { name: "Recent Activity", href: `/league/${leagueId}/activity`, icon: Activity },
          ],
        },
        {
          title: "History",
          items: [
            { name: "Championships", href: `/league/${leagueId}/history`, icon: Trophy },
            { name: "Draft Board", href: `/league/${leagueId}/draft-board`, icon: LayoutGrid },
          ],
        },
        {
          title: "Settings",
          items: [
            { name: "League Settings", href: `/league/${leagueId}/settings`, icon: Settings },
            ...(isAdmin ? [{ name: "Admin Panel", href: "/admin", icon: Shield }] : []),
          ],
        },
      ]
    : [];

  const sections = isLeaguePage ? leagueSections : dashboardSections;

  const isActiveLink = (href: string) => {
    if (pathname === href) return true;

    // Handle hash links
    if (href.includes("#")) {
      const basePath = href.split("#")[0];
      return pathname === basePath;
    }

    // Check if pathname starts with href
    if (href !== "/" && pathname.startsWith(href)) {
      // Special case: /team route should only match exact
      if (href.endsWith("/team")) {
        return pathname === href || pathname === href + "/";
      }
      return true;
    }

    return false;
  };

  return (
    <aside
      className="hidden lg:flex lg:flex-col lg:w-60 xl:w-64 border-r border-white/[0.06] bg-[#080c14] min-h-[calc(100vh-3.5rem)]"
      aria-label="Main navigation"
    >
      {/* Back to Leagues when in league view */}
      {isLeaguePage && (
        <div className="px-4 pt-4">
          <Link
            href="/leagues"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-400 transition-colors px-2 py-1.5 -ml-2 rounded-lg hover:bg-[#1a2435]"
          >
            <ChevronLeft className="w-4 h-4" />
            All Leagues
          </Link>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 overflow-y-auto hide-scrollbar" role="navigation">
        {sections.map((section, sectionIndex) => (
          <div key={section.title} className={cn(sectionIndex > 0 && "mt-6")}>
            {/* Section Header */}
            <div className="px-3 pb-2">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {section.title}
              </h3>
            </div>

            {/* Section Items */}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = isActiveLink(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
                      isActive
                        ? "bg-[#243044] text-white border-l-2 border-blue-500 pl-[10px]"
                        : "text-slate-400 hover:text-white hover:bg-[#1a2435] border-l-2 border-transparent pl-[10px]"
                    )}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className={cn(
                        "flex-shrink-0 transition-colors",
                        isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
                      )}
                    />
                    <span className="flex-1 truncate">{item.name}</span>
                    {item.badge && item.badge > 0 && (
                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-semibold rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-4 py-4 border-t border-white/[0.06]">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-600">{new Date().getFullYear()} Season</p>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Connected" />
        </div>
      </div>
    </aside>
  );
}
