import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { notifyTradeStatusChanged } from "@/lib/notifications";
import { VoteType } from "@prisma/client";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ leagueId: string; proposalId: string }>;
}

function createApiError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: message, details, timestamp: new Date().toISOString() },
    { status }
  );
}

const ResponseSchema = z.object({
  action: z.enum(["accept", "reject", "counter", "cancel"]),
  counterProposal: z
    .object({
      notes: z.string().max(1000).optional(),
      parties: z.array(
        z.object({
          rosterId: z.string(),
          sending: z.array(
            z.object({
              type: z.enum(["PLAYER", "DRAFT_PICK"]),
              playerId: z.string().optional(),
              pickSeason: z.number().optional(),
              pickRound: z.number().optional(),
            })
          ),
        })
      ),
    })
    .optional(),
});

const VoteSchema = z.object({
  vote: z.enum(["APPROVE", "VETO", "ABSTAIN"]),
  comment: z.string().max(500).optional(),
});

/**
 * GET /api/leagues/[leagueId]/trade-proposals/[proposalId]
 * Get a specific trade proposal with full details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId, proposalId } = await params;

    if (!session?.user?.id) {
      return createApiError("Authentication required", 401);
    }

    // Verify user has access to league
    const userAccess = await prisma.teamMember.findFirst({
      where: {
        userId: session.user.id,
        roster: { leagueId },
      },
      include: {
        roster: { select: { id: true } },
      },
    });

    if (!userAccess) {
      return createApiError("You don't have access to this league", 403);
    }

    const proposal = await prisma.tradeProposal.findUnique({
      where: { id: proposalId },
      include: {
        league: {
          select: { id: true, name: true, totalRosters: true },
        },
        proposer: {
          select: {
            id: true,
            teamName: true,
            teamMembers: {
              include: {
                user: {
                  select: { id: true, displayName: true, sleeperUsername: true, avatar: true },
                },
              },
            },
          },
        },
        parties: {
          include: {
            roster: {
              select: {
                id: true,
                teamName: true,
                teamMembers: {
                  include: {
                    user: {
                      select: { id: true, displayName: true, sleeperUsername: true, avatar: true },
                    },
                  },
                },
              },
            },
          },
        },
        assets: {
          include: {
            player: {
              select: {
                id: true,
                fullName: true,
                position: true,
                team: true,
                age: true,
                yearsExp: true,
              },
            },
            fromRoster: { select: { id: true, teamName: true } },
            toRoster: { select: { id: true, teamName: true } },
          },
        },
        votes: {
          include: {
            roster: {
              select: {
                id: true,
                teamName: true,
                teamMembers: {
                  include: {
                    user: { select: { displayName: true, sleeperUsername: true, avatar: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!proposal || proposal.leagueId !== leagueId) {
      return createApiError("Trade proposal not found", 404);
    }

    // Check if expired
    const isExpired = proposal.expiresAt && new Date() > proposal.expiresAt;
    if (isExpired && proposal.status === "PENDING") {
      // Auto-expire the proposal
      await prisma.tradeProposal.update({
        where: { id: proposalId },
        data: { status: "EXPIRED" },
      });
      proposal.status = "EXPIRED";
    }

    // Determine user's role
    const userRosterId = userAccess.roster.id;
    const isProposer = proposal.proposerId === userRosterId;
    const isParty = proposal.parties.some((p) => p.rosterId === userRosterId);
    const userParty = proposal.parties.find((p) => p.rosterId === userRosterId);
    const userVote = proposal.votes.find((v) => v.rosterId === userRosterId);

    // Calculate vote thresholds (majority needed to veto)
    const vetoThreshold = Math.ceil(proposal.league.totalRosters / 2);
    const vetoCount = proposal.votes.filter((v) => v.vote === "VETO").length;
    const isVetoed = vetoCount >= vetoThreshold;

    // Group assets by sender
    const assetsByParty: Record<
      string,
      {
        sending: typeof proposal.assets;
        receiving: typeof proposal.assets;
      }
    > = {};

    for (const party of proposal.parties) {
      assetsByParty[party.rosterId] = {
        sending: proposal.assets.filter((a) => a.fromRosterId === party.rosterId),
        receiving: proposal.assets.filter((a) => a.toRosterId === party.rosterId),
      };
    }

    return NextResponse.json({
      proposal: {
        id: proposal.id,
        title: proposal.title,
        notes: proposal.notes,
        status: isVetoed && proposal.status === "PENDING" ? "VETOED" : proposal.status,
        expiresAt: proposal.expiresAt?.toISOString(),
        createdAt: proposal.createdAt.toISOString(),
        updatedAt: proposal.updatedAt.toISOString(),
        respondedAt: proposal.respondedAt?.toISOString(),
        tradeAnalysis: proposal.tradeAnalysis,
        league: proposal.league,
        proposer: {
          rosterId: proposal.proposer.id,
          teamName: proposal.proposer.teamName,
          owner: proposal.proposer.teamMembers[0]?.user,
        },
        parties: proposal.parties.map((party) => ({
          rosterId: party.rosterId,
          teamName: party.roster.teamName,
          status: party.status,
          respondedAt: party.respondedAt?.toISOString(),
          owner: party.roster.teamMembers[0]?.user,
          assets: assetsByParty[party.rosterId],
        })),
        votes: {
          approve: proposal.votes.filter((v) => v.vote === "APPROVE").length,
          veto: proposal.votes.filter((v) => v.vote === "VETO").length,
          abstain: proposal.votes.filter((v) => v.vote === "ABSTAIN").length,
          vetoThreshold,
          isVetoed,
          details: proposal.votes.map((v) => ({
            rosterId: v.rosterId,
            teamName: v.roster.teamName,
            vote: v.vote,
            comment: v.comment,
            voter: v.roster.teamMembers[0]?.user,
            createdAt: v.createdAt.toISOString(),
          })),
        },
      },
      userContext: {
        rosterId: userRosterId,
        isProposer,
        isParty,
        partyStatus: userParty?.status,
        hasVoted: !!userVote,
        userVote: userVote?.vote,
        canRespond: isParty && userParty?.status === "PENDING" && proposal.status === "PENDING",
        canVote: !isParty && proposal.status === "PENDING" && !userVote,
        canCancel: isProposer && proposal.status === "PENDING",
      },
    });
  } catch (error) {
    logger.error("Error fetching trade proposal", error);
    return createApiError(
      "Failed to fetch trade proposal",
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

/**
 * POST /api/leagues/[leagueId]/trade-proposals/[proposalId]
 * Respond to a trade proposal (accept, reject, counter) or vote
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId, proposalId } = await params;

    if (!session?.user?.id) {
      return createApiError("Authentication required", 401);
    }

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const isVote = searchParams.get("action") === "vote";

    // Get user's roster
    const userMembership = await prisma.teamMember.findFirst({
      where: {
        userId: session.user.id,
        roster: { leagueId },
      },
      include: {
        roster: { select: { id: true, teamName: true } },
        user: { select: { displayName: true, sleeperUsername: true } },
      },
    });

    if (!userMembership) {
      return createApiError("You don't have a team in this league", 403);
    }

    // Get the proposal
    const proposal = await prisma.tradeProposal.findUnique({
      where: { id: proposalId },
      include: {
        league: { select: { name: true, totalRosters: true } },
        parties: true,
        votes: true,
      },
    });

    if (!proposal || proposal.leagueId !== leagueId) {
      return createApiError("Trade proposal not found", 404);
    }

    if (proposal.status !== "PENDING") {
      return createApiError(`This proposal is already ${proposal.status.toLowerCase()}`, 400);
    }

    // Check if expired
    if (proposal.expiresAt && new Date() > proposal.expiresAt) {
      await prisma.tradeProposal.update({
        where: { id: proposalId },
        data: { status: "EXPIRED" },
      });
      return createApiError("This proposal has expired", 400);
    }

    const userRosterId = userMembership.roster.id;
    const isParty = proposal.parties.some((p) => p.rosterId === userRosterId);
    const userParty = proposal.parties.find((p) => p.rosterId === userRosterId);

    // Handle voting (non-party members only)
    if (isVote) {
      if (isParty) {
        return createApiError("Trade parties cannot vote on their own trade", 400);
      }

      const validatedVote = VoteSchema.parse(body);

      // Check if already voted
      const existingVote = proposal.votes.find((v) => v.rosterId === userRosterId);
      if (existingVote) {
        // Update existing vote
        await prisma.tradeProposalVote.update({
          where: { id: existingVote.id },
          data: {
            vote: validatedVote.vote as VoteType,
            comment: validatedVote.comment,
          },
        });
      } else {
        // Create new vote
        await prisma.tradeProposalVote.create({
          data: {
            proposalId,
            rosterId: userRosterId,
            vote: validatedVote.vote as VoteType,
            comment: validatedVote.comment,
          },
        });
      }

      // Check if veto threshold reached
      const updatedVotes = await prisma.tradeProposalVote.findMany({
        where: { proposalId },
      });
      const vetoCount = updatedVotes.filter((v) => v.vote === "VETO").length;
      const vetoThreshold = Math.ceil(proposal.league.totalRosters / 2);

      if (vetoCount >= vetoThreshold) {
        await prisma.tradeProposal.update({
          where: { id: proposalId },
          data: { status: "VETOED", respondedAt: new Date() },
        });

        // Notify parties of veto
        const partyUserIds = await getPartyUserIds(proposal.parties.map((p) => p.rosterId));
        await notifyTradeStatusChanged({
          proposalId,
          status: "VETOED",
          leagueId,
          leagueName: proposal.league.name,
          userIds: partyUserIds,
        }).catch((err) => logger.error("Failed to notify trade status changed", err));

        return NextResponse.json({
          success: true,
          message: "Vote recorded. Trade has been vetoed by the league.",
          status: "VETOED",
        });
      }

      return NextResponse.json({
        success: true,
        message: "Vote recorded",
        votes: {
          approve: updatedVotes.filter((v) => v.vote === "APPROVE").length,
          veto: vetoCount,
          abstain: updatedVotes.filter((v) => v.vote === "ABSTAIN").length,
          vetoThreshold,
        },
      });
    }

    // Handle response from party
    if (!isParty) {
      return createApiError("Only trade parties can respond to this proposal", 403);
    }

    if (userParty?.status !== "PENDING") {
      return createApiError("You have already responded to this proposal", 400);
    }

    const validatedResponse = ResponseSchema.parse(body);

    switch (validatedResponse.action) {
      case "accept": {
        // Update party status
        await prisma.tradeProposalParty.updateMany({
          where: { proposalId, rosterId: userRosterId },
          data: { status: "ACCEPTED", respondedAt: new Date() },
        });

        // Check if all parties accepted
        const updatedParties = await prisma.tradeProposalParty.findMany({
          where: { proposalId },
        });
        const allAccepted = updatedParties.every((p) => p.status === "ACCEPTED");

        if (allAccepted) {
          await prisma.tradeProposal.update({
            where: { id: proposalId },
            data: { status: "ACCEPTED", respondedAt: new Date() },
          });

          // Log the trade
          await prisma.auditLog.create({
            data: {
              userId: session.user.id,
              action: "ACCEPT",
              entity: "TradeProposal",
              entityId: proposalId,
              newValue: { acceptedBy: userRosterId, allPartiesAccepted: true },
            },
          });

          // Notify all league members
          const allUserIds = await getAllLeagueUserIds(leagueId);
          await notifyTradeStatusChanged({
            proposalId,
            status: "ACCEPTED",
            leagueId,
            leagueName: proposal.league.name,
            userIds: allUserIds,
          }).catch((err) => logger.error("Failed to notify trade status changed", err));

          return NextResponse.json({
            success: true,
            message: "Trade accepted! All parties have agreed.",
            status: "ACCEPTED",
          });
        }

        return NextResponse.json({
          success: true,
          message: "You accepted the trade. Waiting for other parties.",
          partiesAccepted: updatedParties.filter((p) => p.status === "ACCEPTED").length,
          partiesTotal: updatedParties.length,
        });
      }

      case "reject": {
        await prisma.$transaction([
          prisma.tradeProposalParty.updateMany({
            where: { proposalId, rosterId: userRosterId },
            data: { status: "REJECTED", respondedAt: new Date() },
          }),
          prisma.tradeProposal.update({
            where: { id: proposalId },
            data: { status: "REJECTED", respondedAt: new Date() },
          }),
          prisma.auditLog.create({
            data: {
              userId: session.user.id,
              action: "REJECT",
              entity: "TradeProposal",
              entityId: proposalId,
              newValue: { rejectedBy: userRosterId },
            },
          }),
        ]);

        // Notify other parties
        const partyUserIds = await getPartyUserIds(
          proposal.parties.filter((p) => p.rosterId !== userRosterId).map((p) => p.rosterId)
        );
        const rejecterName =
          userMembership.user.displayName || userMembership.user.sleeperUsername;
        await notifyTradeStatusChanged({
          proposalId,
          status: "REJECTED",
          leagueId,
          leagueName: proposal.league.name,
          userIds: partyUserIds,
          actionByName: rejecterName,
        }).catch((err) => logger.error("Failed to notify trade status changed", err));

        return NextResponse.json({
          success: true,
          message: "Trade rejected",
          status: "REJECTED",
        });
      }

      case "cancel": {
        if (proposal.proposerId !== userRosterId) {
          return createApiError("Only the proposer can cancel this trade", 403);
        }

        await prisma.$transaction([
          prisma.tradeProposal.update({
            where: { id: proposalId },
            data: { status: "CANCELLED", respondedAt: new Date() },
          }),
          prisma.auditLog.create({
            data: {
              userId: session.user.id,
              action: "CANCEL",
              entity: "TradeProposal",
              entityId: proposalId,
            },
          }),
        ]);

        return NextResponse.json({
          success: true,
          message: "Trade cancelled",
          status: "CANCELLED",
        });
      }

      case "counter": {
        // Mark original as countered
        await prisma.tradeProposal.update({
          where: { id: proposalId },
          data: { status: "COUNTERED", respondedAt: new Date() },
        });

        // TODO: Create new counter proposal with modified terms
        // This would create a new proposal linked to the original

        return NextResponse.json({
          success: true,
          message: "Counter proposal feature coming soon",
          status: "COUNTERED",
        });
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiError("Invalid request data", 400, error.issues);
    }
    logger.error("Error responding to trade proposal", error);
    return createApiError(
      "Failed to process response",
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

/**
 * DELETE /api/leagues/[leagueId]/trade-proposals/[proposalId]
 * Cancel a trade proposal (proposer only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId, proposalId } = await params;

    if (!session?.user?.id) {
      return createApiError("Authentication required", 401);
    }

    const userMembership = await prisma.teamMember.findFirst({
      where: {
        userId: session.user.id,
        roster: { leagueId },
      },
      include: {
        roster: { select: { id: true } },
      },
    });

    if (!userMembership) {
      return createApiError("You don't have a team in this league", 403);
    }

    const proposal = await prisma.tradeProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal || proposal.leagueId !== leagueId) {
      return createApiError("Trade proposal not found", 404);
    }

    if (proposal.proposerId !== userMembership.roster.id) {
      return createApiError("Only the proposer can cancel this trade", 403);
    }

    if (proposal.status !== "PENDING") {
      return createApiError(`Cannot cancel a proposal that is ${proposal.status.toLowerCase()}`, 400);
    }

    await prisma.$transaction([
      prisma.tradeProposal.update({
        where: { id: proposalId },
        data: { status: "CANCELLED", respondedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CANCEL",
          entity: "TradeProposal",
          entityId: proposalId,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Trade proposal cancelled",
    });
  } catch (error) {
    logger.error("Error cancelling trade proposal", error);
    return createApiError(
      "Failed to cancel trade proposal",
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

// Helper functions
async function getPartyUserIds(rosterIds: string[]): Promise<string[]> {
  const members = await prisma.teamMember.findMany({
    where: { rosterId: { in: rosterIds } },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

async function getAllLeagueUserIds(leagueId: string): Promise<string[]> {
  const members = await prisma.teamMember.findMany({
    where: { roster: { leagueId } },
    select: { userId: true },
  });
  return [...new Set(members.map((m) => m.userId))];
}
