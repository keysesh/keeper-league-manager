import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyzeTradeComprehensive } from "@/lib/trade/calculator";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

interface TradeRequest {
  team1: {
    rosterId: string;
    players: string[];
    picks: Array<{ season: number; round: number }>;
  };
  team2: {
    rosterId: string;
    players: string[];
    picks: Array<{ season: number; round: number }>;
  };
  tradeDate?: string; // ISO date string, defaults to current date
}

/**
 * POST /api/leagues/[leagueId]/trade/calculate
 * Calculate comprehensive trade impact with facts-based analysis
 *
 * Features:
 * - Per-player keeper value details
 * - Trade deadline impact (preserved vs reset)
 * - Cost trajectory projections
 * - Age and position modifiers
 * - Draft pick valuations
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

    const body: TradeRequest = await request.json();
    const { team1, team2, tradeDate: tradeDateStr } = body;

    if (!team1?.rosterId || !team2?.rosterId) {
      return NextResponse.json(
        { error: "Both team1 and team2 rosters are required" },
        { status: 400 }
      );
    }

    // Parse trade date or use current date
    const tradeDate = tradeDateStr ? new Date(tradeDateStr) : new Date();

    // Use comprehensive trade analyzer
    const analysis = await analyzeTradeComprehensive(
      leagueId,
      team1.rosterId,
      team2.rosterId,
      team1.players || [],
      team2.players || [],
      team1.picks || [],
      team2.picks || [],
      tradeDate
    );

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Error calculating trade:", error);
    return NextResponse.json(
      { error: "Failed to calculate trade" },
      { status: 500 }
    );
  }
}
