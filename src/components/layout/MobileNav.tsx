"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/design-tokens";
import {
  getLeagueTabs,
  getDashboardNav,
  isNavItemActive,
} from "@/lib/navigation";

interface MobileNavProps {
  className?: string;
}

/**
 * Bottom navigation — the single mobile navigation system.
 *
 * Inside a league: the four primary tabs (My Keepers · Board · Trades · League),
 * identical in name/icon/destination to the desktop sidebar (both read
 * lib/navigation.ts). Outside a league: dashboard-scope items.
 */
export function MobileNav({ className }: MobileNavProps) {
  const pathname = usePathname();
  const params = useParams();
  const leagueId = params?.leagueId as string | undefined;

  const isLeaguePage = pathname.includes("/league/") && leagueId;

  const navigation = isLeaguePage
    ? getLeagueTabs(leagueId!)
    : getDashboardNav(false).flatMap((s) => s.items);

  // Inside a league the bar wears the editorial theme (design handoff Aug
  // 2026): app-surface background, hairline top border, brick-text active
  // state. Dashboard scope keeps the original treatment.
  if (isLeaguePage) {
    return (
      <>
        <nav
          className={cn(
            "editorial fixed bottom-0 left-0 right-0 border-t border-[rgba(214,255,232,.10)] z-50 lg:hidden",
            className
          )}
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
          aria-label="Primary"
        >
          <div className="flex pt-2 pb-2">
            {navigation.map((item) => {
              const isActive = isNavItemActive(item, pathname);
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex-1 min-h-[44px] flex flex-col items-center justify-center gap-1.5 transition-colors",
                    isActive ? "text-[#d4674a]" : "text-[#93a08f]"
                  )}
                >
                  <Icon size={20} strokeWidth={1.8} />
                  <span className="text-[10px] leading-none font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Spacer for bottom nav */}
        <div className="h-16 lg:hidden" />
      </>
    );
  }

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-[#0c1219] border-t border-white/[0.08] z-50 lg:hidden",
          className
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
        aria-label="Primary"
      >
        <div className="flex items-center justify-around py-2">
          {navigation.map((item) => {
            const isActive = isNavItemActive(item, pathname);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
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
        </div>
      </nav>

      {/* Spacer for bottom nav */}
      <div className="h-16 lg:hidden" />
    </>
  );
}
