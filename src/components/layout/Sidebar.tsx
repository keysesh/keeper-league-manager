"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { ChevronLeft, Shield } from "lucide-react";
import { cn } from "@/lib/design-tokens";
import {
  getLeagueTabs,
  getLeagueSecondary,
  getDashboardNav,
  isNavItemActive,
  type NavItem,
  type NavSection,
} from "@/lib/navigation";

interface SidebarProps {
  isAdmin?: boolean;
}

/**
 * Desktop sidebar — renders the same IA as the mobile bottom bar
 * (lib/navigation.ts), so names, icons and destinations cannot drift.
 */
export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const leagueId = params?.leagueId as string | undefined;

  const isLeaguePage = pathname.includes("/league/") && leagueId;

  const sections: NavSection[] = isLeaguePage
    ? [
        { title: "Plan", items: getLeagueTabs(leagueId!) },
        { title: "League", items: getLeagueSecondary(leagueId!) },
        ...(isAdmin
          ? [
              {
                title: "Admin",
                items: [
                  {
                    name: "Admin Panel",
                    href: "/admin",
                    icon: Shield,
                    activePrefixes: ["/admin"],
                  } as NavItem,
                ],
              },
            ]
          : []),
      ]
    : getDashboardNav(isAdmin);

  return (
    <aside
      className="hidden lg:flex lg:flex-col lg:w-60 xl:w-64 border-r border-white/[0.08] bg-[#06090f] min-h-[calc(100vh-3.5rem)]"
      aria-label="Main navigation"
    >
      {/* Back to Leagues when in league view */}
      {isLeaguePage && (
        <div className="px-4 pt-4">
          <Link
            href="/leagues"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-400 transition-colors px-2 py-1.5 -ml-2 rounded-lg hover:bg-[#1c2840]"
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
                const isActive = isNavItemActive(item, pathname);
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
                        ? "bg-[#253654] text-white border-l-2 border-blue-500 pl-[10px]"
                        : "text-slate-400 hover:text-white hover:bg-[#1c2840] border-l-2 border-transparent pl-[10px]"
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
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-4 py-4 border-t border-white/[0.08]">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-600">{new Date().getFullYear()} Season</p>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Connected" />
        </div>
      </div>
    </aside>
  );
}
