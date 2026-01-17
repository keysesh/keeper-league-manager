/**
 * Invite Token API
 * GET /api/invite/[token] - Get invite details
 * POST /api/invite/[token] - Accept invite and create/link account
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { encode } from "next-auth/jwt";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/invite/[token]
 * Get invite details (public - for showing invite page)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    const invite = await prisma.leagueInvite.findUnique({
      where: { token },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.status === "ACCEPTED") {
      return NextResponse.json(
        { error: "Invite already used", status: "ACCEPTED" },
        { status: 400 }
      );
    }

    if (invite.status === "REVOKED") {
      return NextResponse.json(
        { error: "Invite has been revoked", status: "REVOKED" },
        { status: 400 }
      );
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        { error: "Invite has expired", status: "EXPIRED" },
        { status: 400 }
      );
    }

    // Get league and roster details
    const [league, roster] = await Promise.all([
      prisma.league.findUnique({
        where: { id: invite.leagueId },
        select: { id: true, name: true, season: true },
      }),
      prisma.roster.findUnique({
        where: { id: invite.rosterId },
        select: { id: true, teamName: true, sleeperId: true },
      }),
    ]);

    if (!league || !roster) {
      return NextResponse.json(
        { error: "League or roster not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      league: {
        id: league.id,
        name: league.name,
        season: league.season,
      },
      roster: {
        id: roster.id,
        teamName: roster.teamName || `Team ${roster.sleeperId}`,
      },
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    logger.error("Failed to get invite", error);
    return NextResponse.json(
      { error: "Failed to get invite" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invite/[token]
 * Accept invite - creates user account and session
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { email, displayName } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const invite = await prisma.leagueInvite.findUnique({
      where: { token },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.status !== "PENDING") {
      return NextResponse.json(
        { error: `Invite is ${invite.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    if (new Date() > invite.expiresAt) {
      await prisma.leagueInvite.update({
        where: { id: invite.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: "Invite has expired" }, { status: 400 });
    }

    // Get roster to link sleeper info
    const roster = await prisma.roster.findUnique({
      where: { id: invite.rosterId },
      select: { sleeperId: true, ownerId: true, teamName: true },
    });

    if (!roster) {
      return NextResponse.json({ error: "Roster not found" }, { status: 404 });
    }

    // Check if email is already used by another user
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email },
    });

    let user;

    if (existingUserByEmail) {
      // Email exists - check if it's already linked to a different sleeper account
      // For now, allow linking if the user doesn't have a sleeperId or matches
      user = existingUserByEmail;
    } else {
      // Create new user with email
      user = await prisma.user.create({
        data: {
          email,
          displayName: displayName || roster.teamName || "Team Owner",
          sleeperId: roster.ownerId || roster.sleeperId,
          sleeperUsername: roster.teamName || "user",
          onboardingComplete: true,
        },
      });
    }

    // Create team membership linking user to roster
    await prisma.teamMember.upsert({
      where: {
        userId_rosterId: {
          userId: user.id,
          rosterId: invite.rosterId,
        },
      },
      update: {
        role: "OWNER",
      },
      create: {
        userId: user.id,
        rosterId: invite.rosterId,
        role: "OWNER",
      },
    });

    // Update roster owner if not set
    if (!roster.ownerId) {
      await prisma.roster.update({
        where: { id: invite.rosterId },
        data: { ownerId: user.sleeperId },
      });
    }

    // Mark invite as accepted
    await prisma.leagueInvite.update({
      where: { id: invite.id },
      data: {
        status: "ACCEPTED",
        acceptedById: user.id,
        acceptedAt: new Date(),
      },
    });

    // Create a session token for the user
    const sessionToken = await encode({
      token: {
        sub: user.id,
        sleeperId: user.sleeperId,
        username: user.sleeperUsername,
        email: user.email,
      },
      secret: process.env.NEXTAUTH_SECRET!,
    });

    // Create session in database
    const sessionExpiry = new Date();
    sessionExpiry.setDate(sessionExpiry.getDate() + 30);

    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires: sessionExpiry,
      },
    });

    // Return success with redirect info
    const response = NextResponse.json({
      success: true,
      leagueId: invite.leagueId,
      rosterId: invite.rosterId,
      redirectUrl: `/league/${invite.leagueId}`,
    });

    // Set the session cookie
    response.cookies.set("next-auth.session-token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: sessionExpiry,
    });

    return response;
  } catch (error) {
    logger.error("Failed to accept invite", error);
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 }
    );
  }
}
