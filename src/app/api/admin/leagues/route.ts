import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const leagues = await prisma.league.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        sleeperId: true,
        season: true,
        status: true,
        totalRosters: true,
        updatedAt: true,
        lastSyncedAt: true,
        _count: {
          select: { rosters: true },
        },
        rosters: {
          select: {
            _count: {
              select: { keepers: true },
            },
          },
        },
      },
    });

    const formattedLeagues = leagues.map((league) => ({
      ...league,
      keeperCount: league.rosters.reduce((sum, r) => sum + r._count.keepers, 0),
    }));

    return NextResponse.json({ leagues: formattedLeagues });
  } catch (error) {
    console.error("Admin leagues error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leagues" },
      { status: 500 }
    );
  }
}
