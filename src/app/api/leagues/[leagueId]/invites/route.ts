/**
 * League Invites API
 * POST /api/leagues/[leagueId]/invites - Create invites for team owners
 * GET /api/leagues/[leagueId]/invites - List all invites (commissioner only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { randomBytes } from "crypto";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

/**
 * GET /api/leagues/[leagueId]/invites
 * List all invites for a league (commissioner only)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leagueId } = await params;

    // Check if user is commissioner
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        rosters: {
          select: {
            id: true,
            sleeperId: true,
            teamName: true,
            ownerId: true,
          },
        },
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    if (league.commissionerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only commissioners can view invites" },
        { status: 403 }
      );
    }

    // Get all invites for this league
    const invites = await prisma.leagueInvite.findMany({
      where: { leagueId },
    });

    // Map invites to rosters
    const rosterInvites = league.rosters.map((roster) => {
      const invite = invites.find((i) => i.rosterId === roster.id);
      return {
        rosterId: roster.id,
        sleeperId: roster.sleeperId,
        teamName: roster.teamName,
        ownerId: roster.ownerId,
        invite: invite
          ? {
              id: invite.id,
              token: invite.token,
              email: invite.email,
              status: invite.status,
              expiresAt: invite.expiresAt,
              acceptedAt: invite.acceptedAt,
            }
          : null,
      };
    });

    return NextResponse.json({
      leagueId,
      leagueName: league.name,
      rosters: rosterInvites,
    });
  } catch (error) {
    logger.error("Failed to get league invites", error);
    return NextResponse.json(
      { error: "Failed to get invites" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leagues/[leagueId]/invites
 * Create or regenerate invites (commissioner only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leagueId } = await params;
    const body = await request.json();
    const { rosterId, email, regenerate, createAll } = body;

    // Check if user is commissioner
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        rosters: {
          select: { id: true, teamName: true },
        },
      },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    if (league.commissionerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only commissioners can create invites" },
        { status: 403 }
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    // Create invites for all rosters
    if (createAll) {
      const invites = await Promise.all(
        league.rosters.map(async (roster) => {
          const existingInvite = await prisma.leagueInvite.findUnique({
            where: { leagueId_rosterId: { leagueId, rosterId: roster.id } },
          });

          if (existingInvite && existingInvite.status === "ACCEPTED") {
            return existingInvite;
          }

          return prisma.leagueInvite.upsert({
            where: { leagueId_rosterId: { leagueId, rosterId: roster.id } },
            update: {
              token: regenerate ? generateToken() : undefined,
              expiresAt,
              status: "PENDING",
            },
            create: {
              leagueId,
              rosterId: roster.id,
              token: generateToken(),
              expiresAt,
            },
          });
        })
      );

      return NextResponse.json({
        success: true,
        invitesCreated: invites.length,
      });
    }

    // Create single invite
    if (!rosterId) {
      return NextResponse.json(
        { error: "rosterId is required" },
        { status: 400 }
      );
    }

    // Verify roster belongs to league
    const roster = league.rosters.find((r) => r.id === rosterId);
    if (!roster) {
      return NextResponse.json(
        { error: "Roster not found in league" },
        { status: 404 }
      );
    }

    const existingInvite = await prisma.leagueInvite.findUnique({
      where: { leagueId_rosterId: { leagueId, rosterId } },
    });

    if (existingInvite?.status === "ACCEPTED" && !regenerate) {
      return NextResponse.json(
        { error: "Invite already accepted" },
        { status: 400 }
      );
    }

    const invite = await prisma.leagueInvite.upsert({
      where: { leagueId_rosterId: { leagueId, rosterId } },
      update: {
        token: generateToken(),
        email: email || null,
        expiresAt,
        status: "PENDING",
        acceptedById: null,
        acceptedAt: null,
      },
      create: {
        leagueId,
        rosterId,
        token: generateToken(),
        email: email || null,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "https://keeper-league-manager.vercel.app";
    const inviteUrl = `${baseUrl}/invite/${invite.token}`;

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        token: invite.token,
        url: inviteUrl,
        email: invite.email,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    logger.error("Failed to create invite", error);
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/leagues/[leagueId]/invites
 * Revoke an invite
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leagueId } = await params;
    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get("inviteId");

    if (!inviteId) {
      return NextResponse.json(
        { error: "inviteId is required" },
        { status: 400 }
      );
    }

    // Check if user is commissioner
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league || league.commissionerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.leagueInvite.update({
      where: { id: inviteId },
      data: { status: "REVOKED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to revoke invite", error);
    return NextResponse.json(
      { error: "Failed to revoke invite" },
      { status: 500 }
    );
  }
}
