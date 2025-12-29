import { NextResponse } from "next/server";

export interface SyncContext {
  userId: string;
  leagueId?: string;
  sleeperLeagueId?: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export type SyncHandler = (
  context: SyncContext,
  body: Record<string, unknown>
) => Promise<NextResponse>;

export function createSyncResponse(result: SyncResult, status = 200): NextResponse {
  return NextResponse.json(result, { status });
}

export function createSyncError(message: string, status = 400, details?: unknown): NextResponse {
  return NextResponse.json(
    { success: false, error: message, details },
    { status }
  );
}
