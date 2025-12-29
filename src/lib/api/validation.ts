/**
 * API Request Validation Schemas
 * Centralized Zod schemas for API route input validation
 */

import { z } from "zod";

// ============================================
// COMMON SCHEMAS
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const seasonSchema = z.coerce.number().int().min(2020).max(2100);

export const leagueIdSchema = z.string().min(1, "League ID is required");

export const rosterIdSchema = z.string().min(1, "Roster ID is required");

export const playerIdSchema = z.string().min(1, "Player ID is required");

// ============================================
// SYNC SCHEMAS
// ============================================

export const syncActionSchema = z.enum([
  "full",
  "quick",
  "players",
  "transactions",
  "drafts",
  "history",
]);

export const syncRequestSchema = z.object({
  action: syncActionSchema,
  leagueId: z.string().optional(),
  sleeperLeagueId: z.string().optional(),
  season: seasonSchema.optional(),
  maxSeasons: z.coerce.number().int().min(1).max(20).optional(),
});

// ============================================
// KEEPER SCHEMAS
// ============================================

export const keeperTypeSchema = z.enum(["FRANCHISE", "REGULAR"]);

export const addKeeperSchema = z.object({
  playerId: playerIdSchema,
  type: keeperTypeSchema,
});

export const removeKeeperSchema = z.object({
  playerId: playerIdSchema,
});

export const updateKeeperSchema = z.object({
  keeperId: z.string().min(1),
  type: keeperTypeSchema.optional(),
  notes: z.string().max(500).optional(),
});

// ============================================
// TRADE ANALYZER SCHEMAS
// ============================================

export const tradePickSchema = z.object({
  season: seasonSchema,
  round: z.number().int().min(1).max(20),
  originalOwner: z.string().optional(),
});

export const tradeTeamSchema = z.object({
  rosterId: rosterIdSchema,
  players: z.array(playerIdSchema).default([]),
  picks: z.array(tradePickSchema).default([]),
});

export const tradeRequestSchema = z.object({
  team1: tradeTeamSchema,
  team2: tradeTeamSchema,
  season: seasonSchema,
});

// ============================================
// ADMIN SCHEMAS
// ============================================

export const playerSearchSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().max(100).optional(),
  position: z.string().max(10).optional(),
});

export const updatePlayerSchema = z.object({
  playerId: playerIdSchema,
  status: z.string().optional(),
  team: z.string().optional(),
  injuryStatus: z.string().nullable().optional(),
});

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Safely parse and validate request body
 */
export async function validateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      return { success: false, error: errors };
    }

    return { success: true, data: result.data };
  } catch {
    return { success: false, error: "Invalid JSON body" };
  }
}

/**
 * Safely parse and validate URL search params
 */
export function validateSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const result = schema.safeParse(params);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return { success: false, error: errors };
  }

  return { success: true, data: result.data };
}
