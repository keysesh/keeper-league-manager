import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { cache } from "@/lib/cache";

/**
 * GET /api/admin/cache
 * Get cache statistics (admin only)
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

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const stats = cache.getStats();

    return NextResponse.json({
      cacheSize: stats.size,
      cacheKeys: stats.keys,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error getting cache stats", error);
    return NextResponse.json(
      { error: "Failed to get cache stats" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/cache
 * Clear cache (admin only)
 */
export async function DELETE(request: NextRequest) {
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
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const pattern = searchParams.get("pattern");

    if (pattern) {
      // Clear specific pattern
      cache.deletePattern(pattern);
      return NextResponse.json({
        success: true,
        message: `Cleared cache entries matching: ${pattern}`,
      });
    }

    // Clear all cache
    cache.clear();
    return NextResponse.json({
      success: true,
      message: "All cache cleared",
    });
  } catch (error) {
    logger.error("Error clearing cache", error);
    return NextResponse.json(
      { error: "Failed to clear cache" },
      { status: 500 }
    );
  }
}
