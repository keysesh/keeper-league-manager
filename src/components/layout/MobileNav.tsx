"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  Home,
  User,
  BarChart3,
  ArrowLeftRight,
  MoreHorizontal,
  LayoutDashboard,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/design-tokens";
import { useState } from "react";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface MobileNavProps {
  className?: string;
}

export function MobileNav({ className }: MobileNavProps) {
  const pathname = usePathname();
  const params = useParams();
  const leagueId = params?.leagueId as string | undefined;
  const [showMore, setShowMore] = useState(false);

  const isLeaguePage = pathname.includes("/league/") && leagueId;

  // Dashboard navigation (when not in a league)
  const dashboardNav: NavItem[] = [
    { name: "Home", href: "/leagues", icon: Home },
    { name: "Profile", href: "/profile", icon: UserCircle },
  ];

  // League navigation (when inside a league)
  const leagueNav: NavItem[] = leagueId
    ? [
        { name: "Home", href: `/league/${leagueId}`, icon: Home },
        { name: "Team", href: `/league/${leagueId}/my-team`, icon: User },
        { name: "League", href: `/league/${leagueId}/standings`, icon: BarChart3 },
        { name: "Trades", href: `/league/${leagueId}/trade-analyzer`, icon: ArrowLeftRight },
      ]
    : [];

  const navigation = isLeaguePage ? leagueNav : dashboardNav;

  // More menu items for league view
  const moreItems: NavItem[] = leagueId
    ? [
        { name: "Power Rankings", href: `/league/${leagueId}/power-rankings`, icon: BarChart3 },
        { name: "Luck Factor", href: `/league/${leagueId}/luck`, icon: BarChart3 },
        { name: "All Teams", href: `/league/${leagueId}/team`, icon: User },
        { name: "Trade Proposals", href: `/league/${leagueId}/trade-proposals`, icon: ArrowLeftRight },
        { name: "Activity", href: `/league/${leagueId}/activity`, icon: LayoutDashboard },
        { name: "History", href: `/league/${leagueId}/history`, icon: LayoutDashboard },
        { name: "Settings", href: `/league/${leagueId}/settings`, icon: LayoutDashboard },
      ]
    : [];

  const isActiveLink = (href: string) => {
    if (pathname === href) return true;
    if (href !== "/" && pathname.startsWith(href)) {
      if (href.endsWith("/team")) {
        return pathname === href || pathname === href + "/";
      }
      return true;
    }
    return false;
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-[#0d1420] border-t border-white/[0.06] z-50 lg:hidden",
          className
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <div className="flex items-center justify-around py-2">
          {navigation.map((item) => {
            const isActive = isActiveLink(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center py-1 px-3 min-w-[64px] tap-target transition-colors",
                  isActive ? "text-blue-500" : "text-slate-500"
                )}
              >
                <Icon size={22} strokeWidth={1.5} />
                <span className="text-[10px] mt-1 font-medium">{item.name}</span>
              </Link>
            );
          })}

          {/* More button for league view */}
          {isLeaguePage && (
            <button
              onClick={() => setShowMore(!showMore)}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-3 min-w-[64px] tap-target transition-colors",
                showMore ? "text-blue-500" : "text-slate-500"
              )}
            >
              <MoreHorizontal size={22} strokeWidth={1.5} />
              <span className="text-[10px] mt-1 font-medium">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* More Menu Sheet */}
      {showMore && isLeaguePage && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-fade-in"
            onClick={() => setShowMore(false)}
          />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 bg-[#0d1420] border-t border-white/[0.1] rounded-t-2xl z-50 lg:hidden animate-slide-up pb-safe">
            <div className="p-4">
              {/* Handle */}
              <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4" />

              {/* Header */}
              <h3 className="text-lg font-semibold text-white mb-4">More Options</h3>

              {/* Menu Items */}
              <div className="grid grid-cols-3 gap-2">
                {moreItems.map((item) => {
                  const isActive = isActiveLink(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setShowMore(false)}
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-xl transition-colors",
                        isActive
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]"
                      )}
                    >
                      <Icon size={24} strokeWidth={1.5} />
                      <span className="text-xs mt-2 text-center">{item.name}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Back to leagues link */}
              <Link
                href="/leagues"
                onClick={() => setShowMore(false)}
                className="flex items-center justify-center gap-2 w-full mt-4 py-3 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Back to All Leagues
              </Link>
            </div>

            {/* Extra padding for bottom nav */}
            <div className="h-20" />
          </div>
        </>
      )}

      {/* Spacer for bottom nav */}
      <div className="h-16 lg:hidden" />
    </>
  );
}
