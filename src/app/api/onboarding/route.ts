import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  createErrorResponse,
} from "@/lib/errors";

/**
 * GET /api/onboarding
 * Get onboarding status for the current user
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        onboardingComplete: true,
        displayName: true,
        sleeperUsername: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User", session.user.id);
    }

    // Check if user has any leagues
    const leagueCount = await prisma.league.count({
      where: {
        rosters: {
          some: {
            teamMembers: {
              some: { userId: session.user.id },
            },
          },
        },
      },
    });

    return NextResponse.json({
      onboardingComplete: user.onboardingComplete,
      displayName: user.displayName,
      sleeperUsername: user.sleeperUsername,
      createdAt: user.createdAt,
      hasLeagues: leagueCount > 0,
      leagueCount,
    });
  } catch (error) {
    return createErrorResponse(error, { action: "get_onboarding_status" });
  }
}

/**
 * POST /api/onboarding
 * Complete onboarding for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const body = await request.json();
    const { action } = body;

    if (action === "complete" || action === "skip") {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { onboardingComplete: true },
      });

      return NextResponse.json({
        success: true,
        message: action === "complete" ? "Onboarding completed" : "Onboarding skipped",
      });
    }

    throw new ValidationError(
      "Invalid action. Must be 'complete' or 'skip'",
      { action: ["Must be 'complete' or 'skip'"] }
    );
  } catch (error) {
    return createErrorResponse(error, { action: "update_onboarding" });
  }
}
