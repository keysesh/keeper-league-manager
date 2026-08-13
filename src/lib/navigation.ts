/**
 * Navigation — single source of truth for the app's information architecture.
 *
 * Consumed by Sidebar (desktop), MobileNav (bottom tabs) and Breadcrumbs so
 * labels, icons, destinations and active-state rules can never drift between
 * surfaces (previously three nav systems disagreed on all four).
 *
 * League IA (four primary destinations):
 *   My Keepers  — the planning workspace (default landing inside a league)
 *   Board       — league-wide draft/keeper board + simulation
 *   Trades      — trade analysis + saved proposals
 *   League      — reference: overview, teams, activity, settings
 */

import {
  Crown,
  LayoutGrid,
  ArrowLeftRight,
  Trophy,
  Users,
  Settings,
  Activity,
  FileText,
  UserCircle,
  LayoutDashboard,
  Shield,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Path prefixes (relative to nowhere — full pathnames) that mark this item active */
  activePrefixes: string[];
  /** Prefixes that must NOT activate this item even though they match a prefix */
  excludePrefixes?: string[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** The four primary league tabs — identical on mobile bottom bar and desktop sidebar */
export function getLeagueTabs(leagueId: string): NavItem[] {
  const base = `/league/${leagueId}`;
  return [
    {
      name: "My Keepers",
      href: `${base}/keepers`,
      icon: Crown,
      activePrefixes: [`${base}/keepers`, `${base}/my-team`],
    },
    {
      name: "Board",
      href: `${base}/draft-board`,
      icon: LayoutGrid,
      activePrefixes: [`${base}/draft-board`, `${base}/simulation`],
    },
    {
      name: "Trades",
      href: `${base}/trade-analyzer`,
      icon: ArrowLeftRight,
      activePrefixes: [`${base}/trade-analyzer`, `${base}/trade-proposals`],
    },
    {
      name: "League",
      href: base,
      icon: Trophy,
      activePrefixes: [base],
      // Everything under the league that belongs to another tab
      excludePrefixes: [
        `${base}/keepers`,
        `${base}/my-team`,
        `${base}/draft-board`,
        `${base}/simulation`,
        `${base}/trade-analyzer`,
        `${base}/trade-proposals`,
      ],
    },
  ];
}

/** Secondary league destinations — desktop sidebar section + League page links */
export function getLeagueSecondary(leagueId: string): NavItem[] {
  const base = `/league/${leagueId}`;
  return [
    {
      name: "All Teams",
      href: `${base}/team`,
      icon: Users,
      activePrefixes: [`${base}/team`],
    },
    {
      name: "Trade Proposals",
      href: `${base}/trade-proposals`,
      icon: FileText,
      activePrefixes: [`${base}/trade-proposals`],
    },
    {
      name: "Activity",
      href: `${base}/activity`,
      icon: Activity,
      activePrefixes: [`${base}/activity`],
    },
    {
      name: "Settings",
      href: `${base}/settings`,
      icon: Settings,
      activePrefixes: [`${base}/settings`, `${base}/commissioner`],
    },
  ];
}

/** Navigation outside a league (dashboard scope) */
export function getDashboardNav(isAdmin: boolean): NavSection[] {
  return [
    {
      title: "Overview",
      items: [
        {
          name: "My Leagues",
          href: "/leagues",
          icon: LayoutDashboard,
          activePrefixes: ["/leagues"],
        },
        {
          name: "My Profile",
          href: "/profile",
          icon: UserCircle,
          activePrefixes: ["/profile"],
        },
      ],
    },
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
              },
            ],
          },
        ]
      : []),
  ];
}

/** Shared active-state rule for every nav surface */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const matchesPrefix = item.activePrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!matchesPrefix) return false;
  if (item.excludePrefixes?.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return false;
  }
  return true;
}
