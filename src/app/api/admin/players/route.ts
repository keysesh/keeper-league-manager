import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10),
      MAX_PAGE_SIZE
    );
    const search = searchParams.get("search") || "";
    const position = searchParams.get("position") || "";

    // Build type-safe where clause
    const where: Prisma.PlayerWhereInput = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (position) {
      where.position = position;
    }

    const [players, total] = await Promise.all([
      prisma.player.findMany({
        where,
        orderBy: [{ searchRank: "asc" }, { fullName: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          sleeperId: true,
          fullName: true,
          position: true,
          team: true,
          yearsExp: true,
          status: true,
        },
      }),
      prisma.player.count({ where }),
    ]);

    return NextResponse.json({
      players,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error("Error fetching players", error);
    return NextResponse.json({ error: "Failed to fetch players" }, { status: 500 });
  }
}
