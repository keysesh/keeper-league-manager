/**
 * Link Discord Account API Route
 * POST /api/auth/link-discord - Link Discord account to existing Sleeper user
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sleeperUsername, discordId, discordUsername } = body;

    if (!sleeperUsername || !discordId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify Sleeper username
    const sleeper = new SleeperClient();
    const sleeperUser = await sleeper.getUser(sleeperUsername);

    if (!sleeperUser) {
      return NextResponse.json(
        { error: "INVALID_USERNAME", message: "Invalid Sleeper username" },
        { status: 400 }
      );
    }

    // Check if user exists in our database
    const existingUser = await prisma.user.findUnique({
      where: { sleeperId: sleeperUser.user_id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "NOT_REGISTERED", message: "No account found for this Sleeper username" },
        { status: 404 }
      );
    }

    if (!existingUser.email) {
      return NextResponse.json(
        { error: "NOT_REGISTERED", message: "Account not fully set up" },
        { status: 404 }
      );
    }

    // Check if Discord is already linked to another account
    const discordLinked = await prisma.user.findUnique({
      where: { discordId },
    });

    if (discordLinked && discordLinked.id !== existingUser.id) {
      return NextResponse.json(
        { error: "DISCORD_IN_USE", message: "This Discord account is already linked to another user" },
        { status: 400 }
      );
    }

    // Link Discord account
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        discordId,
        discordUsername,
      },
    });

    logger.info("Discord account linked", {
      userId: existingUser.id,
      discordId,
    });

    return NextResponse.json({
      success: true,
      message: "Discord account linked successfully",
    });
  } catch (error) {
    logger.error("Failed to link Discord account", error);
    return NextResponse.json(
      { error: "Failed to link Discord account" },
      { status: 500 }
    );
  }
}
