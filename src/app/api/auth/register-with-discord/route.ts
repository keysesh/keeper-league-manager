/**
 * Register with Discord API Route
 * POST /api/auth/register-with-discord - Create new account and link Discord
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";
import { syncUserLeagues } from "@/lib/sleeper/sync";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sleeperUsername, email, discordId, discordUsername } = body;

    if (!sleeperUsername || !email || !discordId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify Sleeper username
    const sleeper = new SleeperClient();
    const sleeperUser = await sleeper.getUser(sleeperUsername);

    if (!sleeperUser) {
      return NextResponse.json(
        { error: "INVALID_USERNAME", message: "Invalid Sleeper username" },
        { status: 400 }
      );
    }

    // Check if Sleeper account is already registered
    const existingSleeperUser = await prisma.user.findUnique({
      where: { sleeperId: sleeperUser.user_id },
    });

    if (existingSleeperUser?.email) {
      return NextResponse.json(
        { error: "USERNAME_CLAIMED", message: "This Sleeper account is already registered" },
        { status: 400 }
      );
    }

    // Check if email is already used
    const emailExists = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (emailExists) {
      return NextResponse.json(
        { error: "EMAIL_IN_USE", message: "This email is already in use" },
        { status: 400 }
      );
    }

    // Check if Discord is already linked to another account
    const discordLinked = await prisma.user.findUnique({
      where: { discordId },
    });

    if (discordLinked) {
      return NextResponse.json(
        { error: "DISCORD_IN_USE", message: "This Discord account is already linked to another user" },
        { status: 400 }
      );
    }

    // Create or update user with email and Discord link
    const user = await prisma.user.upsert({
      where: { sleeperId: sleeperUser.user_id },
      update: {
        email: normalizedEmail,
        sleeperUsername: sleeperUser.username,
        displayName: sleeperUser.display_name,
        avatar: sleeperUser.avatar,
        discordId,
        discordUsername,
        lastLoginAt: new Date(),
      },
      create: {
        email: normalizedEmail,
        sleeperId: sleeperUser.user_id,
        sleeperUsername: sleeperUser.username,
        displayName: sleeperUser.display_name,
        avatar: sleeperUser.avatar,
        discordId,
        discordUsername,
        lastLoginAt: new Date(),
      },
    });

    logger.info("New user registered with Discord", {
      userId: user.id,
      discordId,
    });

    // Auto-sync user's leagues in the background (don't block registration)
    // This links them to their rosters/teams immediately after signup
    syncUserLeagues(user.id).catch((err) => {
      logger.error("Failed to auto-sync leagues after registration", err, {
        userId: user.id,
      });
    });

    return NextResponse.json({
      success: true,
      message: "Account created and Discord linked successfully",
    });
  } catch (error) {
    logger.error("Failed to register with Discord", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
