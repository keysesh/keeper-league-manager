import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

const TradeProposalSchema = z.object({
  title: z.string().min(1).max(100),
  team1: z.object({
    rosterId: z.string(),
    players: z.array(z.string()),
    picks: z.array(z.object({
      season: z.number(),
      round: z.number(),
    })),
  }),
  team2: z.object({
    rosterId: z.string(),
    players: z.array(z.string()),
    picks: z.array(z.object({
      season: z.number(),
      round: z.number(),
    })),
  }),
  analysis: z.object({
    fairnessScore: z.number(),
    team1NetValue: z.number(),
    team2NetValue: z.number(),
  }).optional(),
  notes: z.string().max(500).optional(),
});

/**
 * GET /api/leagues/[leagueId]/trade-proposals
 * Get all trade proposals for a league
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { leagueId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // Get proposals from the database
    // For now, we'll store them in a simple JSON structure
    // In production, you'd have a TradeProposal model in Prisma
    const proposals = await prisma.auditLog.findMany({
      where: {
        entityId: leagueId,
        entity: "TradeProposal",
        action: "CREATE",
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Parse and transform proposals
    const transformedProposals = proposals.map((p) => {
      const data = p.newValue ? JSON.parse(JSON.stringify(p.newValue)) : {};
      return {
        id: p.id,
        ...data,
        createdAt: p.createdAt.toISOString(),
        createdBy: p.userId,
      };
    }).filter((p) => status === "all" || p.status === status || (!p.status && status === "active"));

    return NextResponse.json({
      proposals: transformedProposals,
      count: transformedProposals.length,
    });
  } catch (error) {
    console.error("Error fetching trade proposals:", error);
    return NextResponse.json(
      { error: "Failed to fetch trade proposals" },
      { status: 500 }
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = TradeProposalSchema.parse(body);

    // Verify user has access to this league
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        rosters: {
          select: {
            id: true,
            teamName: true,
            teamMembers: {
              where: { userId: session.user.id },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    const userHasAccess = league.rosters.some((r) => r.teamMembers.length > 0);
    if (!userHasAccess) {
      return NextResponse.json(
        { error: "You don't have access to this league" },
        { status: 403 }
      );
    }

    // Get roster names
    const team1Roster = league.rosters.find((r) => r.id === validatedData.team1.rosterId);
    const team2Roster = league.rosters.find((r) => r.id === validatedData.team2.rosterId);

    // Get player names for the proposal
    const allPlayerIds = [...validatedData.team1.players, ...validatedData.team2.players];
    const players = await prisma.player.findMany({
      where: { id: { in: allPlayerIds } },
      select: { id: true, fullName: true, position: true },
    });

    const playerMap = new Map(players.map((p) => [p.id, p]));

    // Create proposal data
    const proposalData = {
      title: validatedData.title,
      status: "active",
      leagueId,
      team1: {
        ...validatedData.team1,
        rosterName: team1Roster?.teamName || "Unknown Team",
        playerDetails: validatedData.team1.players.map((id) => ({
          id,
          name: playerMap.get(id)?.fullName || "Unknown",
          position: playerMap.get(id)?.position || "?",
        })),
      },
      team2: {
        ...validatedData.team2,
        rosterName: team2Roster?.teamName || "Unknown Team",
        playerDetails: validatedData.team2.players.map((id) => ({
          id,
          name: playerMap.get(id)?.fullName || "Unknown",
          position: playerMap.get(id)?.position || "?",
        })),
      },
      analysis: validatedData.analysis,
      notes: validatedData.notes,
      votes: {
        approve: [],
        reject: [],
        comments: [],
      },
    };

    // Store proposal in audit log (in production, use a dedicated table)
    const proposal = await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "TradeProposal",
        entityId: leagueId,
        newValue: proposalData,
      },
    });

    // Generate shareable link
    const shareUrl = `/league/${leagueId}/trade-proposals/${proposal.id}`;

    return NextResponse.json({
      success: true,
      proposal: {
        id: proposal.id,
        ...proposalData,
        createdAt: proposal.createdAt.toISOString(),
      },
      shareUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid proposal data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating trade proposal:", error);
    return NextResponse.json(
      { error: "Failed to create trade proposal" },
      { status: 500 }
    );
  }
}
