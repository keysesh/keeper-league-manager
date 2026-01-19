import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const leagueName = searchParams.get("name");

    if (!leagueName) {
      // List all leagues
      const leagues = await prisma.league.findMany({
        select: { id: true, name: true, season: true }
      });
      return NextResponse.json({ leagues });
    }

    // Find league by name (case insensitive)
    const league = await prisma.league.findFirst({
      where: {
        name: {
          contains: leagueName,
          mode: "insensitive"
        }
      },
      select: {
        id: true,
        name: true,
        season: true
      }
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    // Delete the league (cascade will handle related records)
    await prisma.league.delete({
      where: { id: league.id }
    });

    // Get remaining leagues
    const remaining = await prisma.league.findMany({
      select: { id: true, name: true, season: true }
    });

    return NextResponse.json({
      success: true,
      deleted: league,
      remaining
    });
  } catch (error) {
    console.error("Delete league error:", error);
    return NextResponse.json(
      { error: "Failed to delete league" },
      { status: 500 }
    );
  }
}

// Also support GET to list leagues
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const leagues = await prisma.league.findMany({
      select: {
        id: true,
        name: true,
        season: true,
        _count: {
          select: { rosters: true }
        }
      }
    });

    return NextResponse.json({ leagues });
  } catch (error) {
    console.error("List leagues error:", error);
    return NextResponse.json(
      { error: "Failed to list leagues" },
      { status: 500 }
    );
  }
}
