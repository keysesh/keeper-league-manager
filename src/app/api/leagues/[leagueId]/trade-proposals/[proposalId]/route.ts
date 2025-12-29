import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ leagueId: string; proposalId: string }>;
}

const VoteSchema = z.object({
  vote: z.enum(["approve", "reject"]),
  comment: z.string().max(200).optional(),
});

/**
 * GET /api/leagues/[leagueId]/trade-proposals/[proposalId]
 * Get a specific trade proposal
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId, proposalId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const proposal = await prisma.auditLog.findUnique({
      where: { id: proposalId },
    });

    if (!proposal || proposal.entity !== "TradeProposal" || proposal.entityId !== leagueId) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    const data = proposal.newValue ? JSON.parse(JSON.stringify(proposal.newValue)) : {};

    // Get creator info
    const creator = proposal.userId ? await prisma.user.findUnique({
      where: { id: proposal.userId },
      select: { displayName: true, sleeperUsername: true, avatar: true },
    }) : null;

    return NextResponse.json({
      proposal: {
        id: proposal.id,
        ...data,
        createdAt: proposal.createdAt.toISOString(),
        createdBy: {
          id: proposal.userId ?? "unknown",
          name: creator?.displayName || creator?.sleeperUsername || "Unknown",
          avatar: creator?.avatar ?? undefined,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching trade proposal:", error);
    return NextResponse.json(
      { error: "Failed to fetch trade proposal" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leagues/[leagueId]/trade-proposals/[proposalId]
 * Vote on a trade proposal
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId, proposalId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = VoteSchema.parse(body);

    // Get the proposal
    const proposal = await prisma.auditLog.findUnique({
      where: { id: proposalId },
    });

    if (!proposal || proposal.entity !== "TradeProposal" || proposal.entityId !== leagueId) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    const data = proposal.newValue ? JSON.parse(JSON.stringify(proposal.newValue)) : {};

    // Initialize votes if needed
    if (!data.votes) {
      data.votes = { approve: [], reject: [], comments: [] };
    }

    // Remove existing vote from this user
    data.votes.approve = data.votes.approve.filter((v: { userId: string }) => v.userId !== session.user.id);
    data.votes.reject = data.votes.reject.filter((v: { userId: string }) => v.userId !== session.user.id);

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { displayName: true, sleeperUsername: true },
    });

    const voteData = {
      userId: session.user.id,
      userName: user?.displayName || user?.sleeperUsername || "Unknown",
      timestamp: new Date().toISOString(),
    };

    // Add new vote
    if (validatedData.vote === "approve") {
      data.votes.approve.push(voteData);
    } else {
      data.votes.reject.push(voteData);
    }

    // Add comment if provided
    if (validatedData.comment) {
      data.votes.comments.push({
        ...voteData,
        comment: validatedData.comment,
      });
    }

    // Update the proposal
    await prisma.auditLog.update({
      where: { id: proposalId },
      data: { newValue: data },
    });

    return NextResponse.json({
      success: true,
      votes: {
        approveCount: data.votes.approve.length,
        rejectCount: data.votes.reject.length,
        userVote: validatedData.vote,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid vote data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error voting on trade proposal:", error);
    return NextResponse.json(
      { error: "Failed to vote on trade proposal" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/leagues/[leagueId]/trade-proposals/[proposalId]
 * Delete/close a trade proposal (creator only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId, proposalId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const proposal = await prisma.auditLog.findUnique({
      where: { id: proposalId },
    });

    if (!proposal || proposal.entity !== "TradeProposal" || proposal.entityId !== leagueId) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    // Only creator can delete
    if (proposal.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the creator can delete this proposal" },
        { status: 403 }
      );
    }

    const data = proposal.newValue ? JSON.parse(JSON.stringify(proposal.newValue)) : {};
    data.status = "closed";

    await prisma.auditLog.update({
      where: { id: proposalId },
      data: { newValue: data },
    });

    return NextResponse.json({
      success: true,
      message: "Proposal closed",
    });
  } catch (error) {
    console.error("Error deleting trade proposal:", error);
    return NextResponse.json(
      { error: "Failed to delete trade proposal" },
      { status: 500 }
    );
  }
}
