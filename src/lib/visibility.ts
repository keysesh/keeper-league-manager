/**
 * Visibility Controls
 * Utilities for managing public vs private page access
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ViewMode = "public" | "member" | "owner" | "commissioner";

export interface ViewAccess {
  mode: ViewMode;
  canEdit: boolean;
  canManageKeepers: boolean;
  canViewSensitiveData: boolean;
  canAccessSettings: boolean;
  isAuthenticated: boolean;
  userId?: string;
  userRosterId?: string;
}

/**
 * Determine the view access level for a user viewing a league
 */
export async function getLeagueViewAccess(leagueId: string): Promise<ViewAccess> {
  const session = await getServerSession(authOptions);

  // Default public access
  const publicAccess: ViewAccess = {
    mode: "public",
    canEdit: false,
    canManageKeepers: false,
    canViewSensitiveData: false,
    canAccessSettings: false,
    isAuthenticated: false,
  };

  if (!session?.user?.id) {
    return publicAccess;
  }

  // Get user's relationship to the league
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      commissionerId: true,
      rosters: {
        where: {
          teamMembers: {
            some: {
              userId: session.user.id,
            },
          },
        },
        include: {
          teamMembers: {
            where: {
              userId: session.user.id,
            },
            select: {
              role: true,
            },
          },
        },
      },
    },
  });

  if (!league) {
    return publicAccess;
  }

  const userRoster = league.rosters[0];
  const isCommissioner = league.commissionerId === session.user.id;
  const isMember = !!userRoster;
  const isOwner = userRoster?.teamMembers.some((tm) => tm.role === "OWNER" || tm.role === "CO_OWNER");

  if (isCommissioner) {
    return {
      mode: "commissioner",
      canEdit: true,
      canManageKeepers: true,
      canViewSensitiveData: true,
      canAccessSettings: true,
      isAuthenticated: true,
      userId: session.user.id,
      userRosterId: userRoster?.id,
    };
  }

  if (isOwner) {
    return {
      mode: "owner",
      canEdit: true,
      canManageKeepers: true,
      canViewSensitiveData: true,
      canAccessSettings: false,
      isAuthenticated: true,
      userId: session.user.id,
      userRosterId: userRoster?.id,
    };
  }

  if (isMember) {
    return {
      mode: "member",
      canEdit: false,
      canManageKeepers: false,
      canViewSensitiveData: true,
      canAccessSettings: false,
      isAuthenticated: true,
      userId: session.user.id,
      userRosterId: userRoster?.id,
    };
  }

  // Authenticated but not a member - still public access
  return {
    ...publicAccess,
    isAuthenticated: true,
    userId: session.user.id,
  };
}

/**
 * Determine the view access level for a user viewing a specific team
 */
export async function getTeamViewAccess(
  leagueId: string,
  rosterId: string
): Promise<ViewAccess & { isOwnTeam: boolean }> {
  const leagueAccess = await getLeagueViewAccess(leagueId);

  const isOwnTeam = leagueAccess.userRosterId === rosterId;

  return {
    ...leagueAccess,
    isOwnTeam,
    // Override edit permissions based on team ownership
    canEdit: isOwnTeam && leagueAccess.canEdit,
    canManageKeepers: isOwnTeam && leagueAccess.canManageKeepers,
  };
}

/**
 * Public routes that don't require authentication
 * These pages show limited data for non-members
 */
export const PUBLIC_LEAGUE_ROUTES = [
  "/league/[leagueId]", // League overview
  "/league/[leagueId]/team", // All teams list
  "/league/[leagueId]/team/[rosterId]", // Individual team view
  "/league/[leagueId]/history", // Historical data
];

/**
 * Member-only routes that require league membership
 */
export const MEMBER_ONLY_ROUTES = [
  "/league/[leagueId]/my-team", // Own team management
  "/league/[leagueId]/trade-analyzer", // Trade analyzer
  "/league/[leagueId]/trade-proposals", // Trade proposals
  "/league/[leagueId]/draft-board", // Draft board
  "/league/[leagueId]/simulation", // Draft simulation
];

/**
 * Commissioner-only routes
 */
export const COMMISSIONER_ONLY_ROUTES = [
  "/league/[leagueId]/settings", // League settings
  "/league/[leagueId]/commissioner", // Commissioner tools
];

/**
 * Check if a route is public
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_LEAGUE_ROUTES.some((route) => {
    const pattern = route.replace(/\[.*?\]/g, "[^/]+");
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(pathname);
  });
}

/**
 * Data visibility rules for different view modes
 */
export const DATA_VISIBILITY = {
  public: {
    showStandings: true,
    showRosters: true,
    showHistory: true,
    showTrades: true,
    showKeepers: false, // Don't show keeper details
    showDraftPlans: false,
    showTradeProposals: false,
    showDetailedStats: false,
  },
  member: {
    showStandings: true,
    showRosters: true,
    showHistory: true,
    showTrades: true,
    showKeepers: true,
    showDraftPlans: false, // Own plans only
    showTradeProposals: true, // Can see proposals
    showDetailedStats: true,
  },
  owner: {
    showStandings: true,
    showRosters: true,
    showHistory: true,
    showTrades: true,
    showKeepers: true,
    showDraftPlans: true, // Own plans
    showTradeProposals: true, // Can manage proposals
    showDetailedStats: true,
  },
  commissioner: {
    showStandings: true,
    showRosters: true,
    showHistory: true,
    showTrades: true,
    showKeepers: true,
    showDraftPlans: true, // All plans
    showTradeProposals: true, // All proposals
    showDetailedStats: true,
  },
} as const;

/**
 * Get visible data based on view mode
 */
export function getDataVisibility(mode: ViewMode) {
  return DATA_VISIBILITY[mode];
}
