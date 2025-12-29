import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { notifyTradeProposed } from "@/lib/notifications";
import { TradeProposalStatus } from "@prisma/client";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

const TradeAssetSchema = z.object({
  type: z.enum(["PLAYER", "DRAFT_PICK"]),
  playerId: z.string().optional(),
  pickSeason: z.number().optional(),
  pickRound: z.number().optional(),
  pickOriginalOwner: z.string().optional(),
});

const TradePartySchema = z.object({
  rosterId: z.string(),
  sending: z.array(TradeAssetSchema),
  receiving: z.array(TradeAssetSchema),
});

const TradeProposalSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  notes: z.string().max(1000).optional(),
  parties: z.array(TradePartySchema).min(2).max(4),
  analysis: z.object({
    fairnessScore: z.number(),
    breakdown: z.record(z.string(), z.unknown()),
  }).optional(),
  expiresInHours: z.number().min(1).max(168).default(48),
});

function createApiError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: message, details, timestamp: new Date().toISOString() },
    { status }
  );
}

/**
 * GET /api/leagues/[leagueId]/trade-proposals
 * Get all trade proposals for a league
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId } = await params;

    if (!session?.user?.id) {
      return createApiError("Authentication required", 401);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as TradeProposalStatus | "all" | null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Verify user has access to league
    const userAccess = await prisma.teamMember.findFirst({
      where: {
        userId: session.user.id,
        roster: { leagueId },
      },
    });

    if (!userAccess) {
      return createApiError("You don't have access to this league", 403);
    }

    // Build where clause
    const where: { leagueId: string; status?: TradeProposalStatus } = { leagueId };
    if (status && status !== "all") {
      where.status = status as TradeProposalStatus;
    }

    // Fetch proposals with all related data
    const [proposals, totalCount] = await Promise.all([
      prisma.tradeProposal.findMany({
        where,
        include: {
          proposer: {
            select: {
              id: true,
              teamName: true,
              teamMembers: {
                include: {
                  user: {
                    select: { displayName: true, sleeperUsername: true, avatar: true },
                  },
                },
              },
            },
          },
          parties: {
            include: {
              roster: {
                select: { id: true, teamName: true },
              },
            },
          },
          assets: {
            include: {
              player: {
                select: { id: true, fullName: true, position: true, team: true },
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
                      user: { select: { displayName: true, sleeperUsername: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.tradeProposal.count({ where }),
    ]);

    // Transform proposals for response
    const transformedProposals = proposals.map((proposal) => ({
      id: proposal.id,
      title: proposal.title,
      notes: proposal.notes,
      status: proposal.status,
      expiresAt: proposal.expiresAt?.toISOString(),
      createdAt: proposal.createdAt.toISOString(),
      updatedAt: proposal.updatedAt.toISOString(),
      respondedAt: proposal.respondedAt?.toISOString(),
      tradeAnalysis: proposal.tradeAnalysis,
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
      })),
      assets: proposal.assets.map((asset) => ({
        id: asset.id,
        type: asset.assetType,
        fromRosterId: asset.fromRosterId,
        fromTeamName: asset.fromRoster.teamName,
        toRosterId: asset.toRosterId,
        toTeamName: asset.toRoster.teamName,
        player: asset.player,
        pickSeason: asset.pickSeason,
        pickRound: asset.pickRound,
        pickOriginalOwner: asset.pickOriginalOwner,
      })),
      votes: {
        approve: proposal.votes.filter((v) => v.vote === "APPROVE").length,
        veto: proposal.votes.filter((v) => v.vote === "VETO").length,
        abstain: proposal.votes.filter((v) => v.vote === "ABSTAIN").length,
        details: proposal.votes.map((v) => ({
          rosterId: v.rosterId,
          teamName: v.roster.teamName,
          vote: v.vote,
          comment: v.comment,
          voter: v.roster.teamMembers[0]?.user,
          createdAt: v.createdAt.toISOString(),
        })),
      },
    }));

    return NextResponse.json({
      proposals: transformedProposals,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + proposals.length < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching trade proposals:", error);
    return createApiError(
      "Failed to fetch trade proposals",
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

/**
 * POST /api/leagues/[leagueId]/trade-proposals
 * Create a new trade proposal
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId } = await params;

    if (!session?.user?.id) {
      return createApiError("Authentication required", 401);
    }

    const body = await request.json();
    const validatedData = TradeProposalSchema.parse(body);

    // Get user's roster in this league
    const userMembership = await prisma.teamMember.findFirst({
      where: {
        userId: session.user.id,
        roster: { leagueId },
      },
      include: {
        roster: {
          select: { id: true, teamName: true },
        },
        user: {
          select: { displayName: true, sleeperUsername: true },
        },
      },
    });

    if (!userMembership) {
      return createApiError("You don't have a team in this league", 403);
    }

    // Verify all roster IDs are valid and in this league
    const partyRosterIds = validatedData.parties.map((p) => p.rosterId);
    const validRosters = await prisma.roster.findMany({
      where: {
        id: { in: partyRosterIds },
        leagueId,
      },
      include: {
        teamMembers: {
          include: {
            user: { select: { id: true, displayName: true, sleeperUsername: true } },
          },
        },
      },
    });

    if (validRosters.length !== partyRosterIds.length) {
      return createApiError("One or more invalid roster IDs", 400);
    }

    // Check that proposer is part of the trade
    if (!partyRosterIds.includes(userMembership.roster.id)) {
      return createApiError("You must be part of the trade to propose it", 400);
    }

    // Get league info for notifications
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: {
        name: true,
        rosters: {
          select: {
            teamMembers: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!league) {
      return createApiError("League not found", 404);
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + validatedData.expiresInHours);

    // Create the proposal with all assets in a transaction
    const proposal = await prisma.$transaction(async (tx) => {
      // Create the proposal
      const newProposal = await tx.tradeProposal.create({
        data: {
          leagueId,
          proposerId: userMembership.roster.id,
          title: validatedData.title || `Trade Proposal`,
          notes: validatedData.notes,
          expiresAt,
          tradeAnalysis: validatedData.analysis as object | undefined,
        },
      });

      // Create parties
      await tx.tradeProposalParty.createMany({
        data: validatedData.parties.map((party) => ({
          proposalId: newProposal.id,
          rosterId: party.rosterId,
          status: party.rosterId === userMembership.roster.id ? "ACCEPTED" : "PENDING",
          respondedAt: party.rosterId === userMembership.roster.id ? new Date() : null,
        })),
      });

      // Create assets
      const assetData: Array<{
        proposalId: string;
        fromRosterId: string;
        toRosterId: string;
        assetType: "PLAYER" | "DRAFT_PICK";
        playerId?: string;
        pickSeason?: number;
        pickRound?: number;
        pickOriginalOwner?: string;
      }> = [];

      for (const party of validatedData.parties) {
        // Process what this party is sending
        for (const asset of party.sending) {
          // Find who receives this asset (the other party)
          const receivingParty = validatedData.parties.find((p) => p.rosterId !== party.rosterId);
          if (!receivingParty) continue;

          assetData.push({
            proposalId: newProposal.id,
            fromRosterId: party.rosterId,
            toRosterId: receivingParty.rosterId,
            assetType: asset.type,
            playerId: asset.playerId,
            pickSeason: asset.pickSeason,
            pickRound: asset.pickRound,
            pickOriginalOwner: asset.pickOriginalOwner,
          });
        }
      }

      if (assetData.length > 0) {
        await tx.tradeProposalAsset.createMany({
          data: assetData,
        });
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entity: "TradeProposal",
          entityId: newProposal.id,
          newValue: {
            proposalId: newProposal.id,
            parties: validatedData.parties.map((p) => p.rosterId),
            assetCount: assetData.length,
          },
        },
      });

      return newProposal;
    });

    // Send notifications
    const proposerName =
      userMembership.user.displayName || userMembership.user.sleeperUsername || "Someone";
    const involvedUserIds = validRosters
      .filter((r) => r.id !== userMembership.roster.id)
      .flatMap((r) => r.teamMembers.map((tm) => tm.user.id));
    const allLeagueUserIds = league.rosters.flatMap((r) =>
      r.teamMembers.map((tm) => tm.userId)
    );

    await notifyTradeProposed({
      proposalId: proposal.id,
      proposerName,
      leagueId,
      leagueName: league.name,
      involvedUserIds,
      leagueUserIds: allLeagueUserIds,
    }).catch(console.error); // Don't fail if notifications fail

    return NextResponse.json({
      success: true,
      proposal: {
        id: proposal.id,
        status: proposal.status,
        expiresAt: proposal.expiresAt?.toISOString(),
        createdAt: proposal.createdAt.toISOString(),
      },
      shareUrl: `/league/${leagueId}/trade-proposals/${proposal.id}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiError("Invalid proposal data", 400, error.issues);
    }
    console.error("Error creating trade proposal:", error);
    return createApiError(
      "Failed to create trade proposal",
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}
