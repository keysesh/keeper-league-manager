import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncAllPlayers } from "@/lib/sleeper/sync";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/sleeper/sync/players
 * Sync all NFL players from Sleeper
 * This is a heavy operation (~10,000 players) - admin only
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required for player sync" },
        { status: 403 }
      );
    }

    console.log("Starting player sync...");
    const result = await syncAllPlayers();

    return NextResponse.json({
      success: true,
      message: "Player sync complete",
      data: result,
    });
  } catch (error) {
    console.error("Player sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Player sync failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sleeper/sync/players
 * Get player sync status
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const [totalPlayers, lastUpdated] = await Promise.all([
      prisma.player.count(),
      prisma.player.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
    ]);

    return NextResponse.json({
      totalPlayers,
      lastUpdated: lastUpdated?.updatedAt || null,
      needsSync: totalPlayers === 0 ||
        (lastUpdated?.updatedAt &&
          new Date().getTime() - lastUpdated.updatedAt.getTime() > 86400000), // 24 hours
    });
  } catch (error) {
    console.error("Error getting player sync status:", error);
    return NextResponse.json(
      { error: "Failed to get player sync status" },
      { status: 500 }
    );
  }
}
