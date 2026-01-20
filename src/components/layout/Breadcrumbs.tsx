"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { useMemo } from "react";

interface BreadcrumbItem {
  label: string;
  href: string;
  current?: boolean;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  leagueName?: string;
  teamName?: string;
  className?: string;
}

/**
 * Breadcrumbs component for navigation hierarchy
 * Can be used with explicit items or auto-generated from pathname
 */
export function Breadcrumbs({ items: explicitItems, leagueName, teamName, className = "" }: BreadcrumbsProps) {
  const pathname = usePathname();
  const params = useParams();
  const leagueId = params?.leagueId as string | undefined;
  const rosterId = params?.rosterId as string | undefined;

  const items = useMemo(() => {
    if (explicitItems) return explicitItems;

    // Auto-generate breadcrumbs from pathname
    const breadcrumbs: BreadcrumbItem[] = [
      { label: "Home", href: "/leagues" },
    ];

    // If we're in a league context
    if (leagueId && pathname.includes("/league/")) {
      breadcrumbs.push({
        label: leagueName || "League",
        href: `/league/${leagueId}`,
      });

      // Determine current page
      const pathAfterLeague = pathname.replace(`/league/${leagueId}`, "");

      if (pathAfterLeague.startsWith("/my-team")) {
        breadcrumbs.push({ label: "My Team", href: `/league/${leagueId}/my-team`, current: true });
      } else if (pathAfterLeague.startsWith("/draft-board")) {
        breadcrumbs.push({ label: "Draft Board", href: `/league/${leagueId}/draft-board`, current: true });
      } else if (pathAfterLeague.startsWith("/trade-analyzer")) {
        breadcrumbs.push({ label: "Trade Analyzer", href: `/league/${leagueId}/trade-analyzer`, current: true });
      } else if (pathAfterLeague.startsWith("/trade-proposals")) {
        breadcrumbs.push({ label: "Trade Proposals", href: `/league/${leagueId}/trade-proposals`, current: true });
      } else if (pathAfterLeague.startsWith("/team/") && rosterId) {
        breadcrumbs.push({ label: "All Teams", href: `/league/${leagueId}/team` });
        breadcrumbs.push({ label: teamName || "Team", href: `/league/${leagueId}/team/${rosterId}`, current: true });
      } else if (pathAfterLeague.startsWith("/team")) {
        breadcrumbs.push({ label: "All Teams", href: `/league/${leagueId}/team`, current: true });
      } else if (pathAfterLeague.startsWith("/settings")) {
        breadcrumbs.push({ label: "Settings", href: `/league/${leagueId}/settings`, current: true });
      } else if (pathAfterLeague.startsWith("/activity")) {
        breadcrumbs.push({ label: "Activity", href: `/league/${leagueId}/activity`, current: true });
      } else if (pathAfterLeague.startsWith("/commissioner")) {
        breadcrumbs.push({ label: "Commissioner", href: `/league/${leagueId}/commissioner`, current: true });
      } else if (pathAfterLeague === "" || pathAfterLeague === "/") {
        // Mark league as current if we're on the overview page
        breadcrumbs[breadcrumbs.length - 1].current = true;
      }
    } else if (pathname === "/leagues" || pathname === "/") {
      breadcrumbs[0].current = true;
    } else if (pathname === "/profile") {
      breadcrumbs.push({ label: "Profile", href: "/profile", current: true });
    } else if (pathname.startsWith("/admin")) {
      breadcrumbs.push({ label: "Admin", href: "/admin", current: true });
    }

    return breadcrumbs;
  }, [explicitItems, pathname, leagueId, rosterId, leagueName, teamName]);

  // Don't show breadcrumbs if we only have home
  if (items.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className={`mb-4 ${className}`}>
      <ol className="flex items-center gap-1.5 text-sm overflow-x-auto">
        {items.map((item, index) => {
          const isFirst = index === 0;
          const isLast = item.current || index === items.length - 1;

          return (
            <li key={item.href} className="flex items-center gap-1.5 min-w-0">
              {!isFirst && (
                <ChevronRight
                  className="w-4 h-4 text-gray-600 flex-shrink-0"
                  aria-hidden="true"
                />
              )}
              {isLast ? (
                <span
                  className="text-gray-300 font-medium truncate max-w-[150px] sm:max-w-[200px]"
                  aria-current="page"
                >
                  {isFirst ? <Home className="w-4 h-4 inline-block -mt-0.5" /> : item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-gray-500 hover:text-blue-400 transition-colors truncate max-w-[150px] sm:max-w-[200px]"
                >
                  {isFirst ? (
                    <Home className="w-4 h-4 inline-block -mt-0.5" />
                  ) : (
                    item.label
                  )}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Compact inline breadcrumb for use in headers
export function InlineBreadcrumb({
  parent,
  current,
  parentHref,
}: {
  parent: string;
  current: string;
  parentHref: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Link href={parentHref} className="text-gray-500 hover:text-blue-400 transition-colors">
        {parent}
      </Link>
      <ChevronRight className="w-4 h-4 text-gray-600" />
      <span className="text-gray-300 font-medium">{current}</span>
    </div>
  );
}
