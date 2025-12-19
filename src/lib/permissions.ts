import { prisma } from "@/lib/prisma";

/**
 * Check if a user is the commissioner of a league
 */
export async function isCommissioner(
  userId: string,
  leagueId: string
): Promise<boolean> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { commissionerId: true },
  });

  return league?.commissionerId === userId;
}

/**
 * Check if a user is an app admin
 */
export async function isAppAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });

  return user?.isAdmin === true;
}

/**
 * Check if a user is either the commissioner of a league OR an app admin
 */
export async function canManageLeague(
  userId: string,
  leagueId: string
): Promise<boolean> {
  const [commissioner, admin] = await Promise.all([
    isCommissioner(userId, leagueId),
    isAppAdmin(userId),
  ]);

  return commissioner || admin;
}

/**
 * Check if a user is a member of a league (owns a team in it)
 */
export async function isLeagueMember(
  userId: string,
  leagueId: string
): Promise<boolean> {
  const membership = await prisma.teamMember.findFirst({
    where: {
      userId,
      roster: { leagueId },
    },
  });

  return membership !== null;
}
