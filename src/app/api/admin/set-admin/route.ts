/**
 * TEMPORARY: Set keysesh as admin
 * DELETE THIS FILE AFTER USE
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const updated = await prisma.user.updateMany({
      where: {
        sleeperUsername: { contains: "keysesh", mode: "insensitive" },
      },
      data: { isAdmin: true },
    });

    return NextResponse.json({
      success: true,
      message: `Updated ${updated.count} user(s) to admin`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
