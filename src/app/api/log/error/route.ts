import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { z } from "zod";

const ErrorLogSchema = z.object({
  type: z.enum(["client_error", "handled_error", "api_error"]),
  message: z.string(),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  url: z.string().optional(),
  userAgent: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string(),
});

/**
 * POST /api/log/error
 * Log client-side errors to the server
 *
 * This endpoint receives error reports from:
 * - Error boundaries
 * - useErrorHandler hook
 * - Manual error logging
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const validatedData = ErrorLogSchema.parse(body);

    // Log to console with structured format
    logger.error(
      `[${validatedData.type}] ${validatedData.message}`,
      validatedData.stack ? new Error(validatedData.stack) : undefined,
      {
        url: validatedData.url,
        userId: session?.user?.id,
        userAgent: validatedData.userAgent?.slice(0, 200),
        context: validatedData.context,
      }
    );

    // Store in database for analysis
    const logData = {
      message: validatedData.message,
      stack: validatedData.stack?.slice(0, 2000),
      componentStack: validatedData.componentStack?.slice(0, 1000),
      url: validatedData.url,
      userAgent: validatedData.userAgent?.slice(0, 200),
      context: validatedData.context ? JSON.stringify(validatedData.context) : undefined,
      timestamp: validatedData.timestamp,
    };

    await prisma.auditLog.create({
      data: {
        userId: session?.user?.id || null,
        action: "ERROR",
        entity: "ErrorLog",
        entityId: validatedData.type,
        newValue: JSON.parse(JSON.stringify(logData)),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Don't throw on error logging failures - just log to console
    logger.error("[ErrorLogging] Failed to log error", error);
    return NextResponse.json(
      { error: "Failed to log error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/log/error
 * Get recent errors (admin only)
 */
export async function GET(request: NextRequest) {
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const type = searchParams.get("type");

    const errors = await prisma.auditLog.findMany({
      where: {
        action: "ERROR",
        entity: "ErrorLog",
        ...(type ? { entityId: type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Get stats
    const stats = await prisma.auditLog.groupBy({
      by: ["entityId"],
      where: {
        action: "ERROR",
        entity: "ErrorLog",
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      _count: { id: true },
    });

    return NextResponse.json({
      errors,
      stats: stats.map((s) => ({
        type: s.entityId,
        count: s._count.id,
      })),
    });
  } catch (error) {
    logger.error("[ErrorLogging] Failed to fetch errors", error);
    return NextResponse.json(
      { error: "Failed to fetch errors" },
      { status: 500 }
    );
  }
}
