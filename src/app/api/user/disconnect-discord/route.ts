/**
 * Disconnect Discord API Route
 * POST /api/user/disconnect-discord - Unlink Discord account from user
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has Discord linked
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { discordId: true },
    });

    if (!user?.discordId) {
      return NextResponse.json(
        { error: "No Discord account linked" },
        { status: 400 }
      );
    }

    // Remove Discord link
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        discordId: null,
        discordUsername: null,
        discordAvatar: null,
      },
    });

    logger.info("Discord account unlinked", {
      userId: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to disconnect Discord", error);
    return NextResponse.json(
      { error: "Failed to disconnect Discord account" },
      { status: 500 }
    );
  }
}
