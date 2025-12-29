/**
 * Centralized Zod validation schemas for API routes
 */
import { z } from "zod";

// ============================================
// Common ID schemas
// ============================================

export const CuidSchema = z.string().cuid();
export const SleeperIdSchema = z.string().min(1).max(50);

// ============================================
// Pagination schemas
// ============================================

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const CursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================
// League schemas
// ============================================

export const LeagueIdParamSchema = z.object({
  leagueId: CuidSchema,
});

export const RosterIdParamSchema = z.object({
  leagueId: CuidSchema,
  rosterId: CuidSchema,
});

// ============================================
// Keeper schemas
// ============================================

export const KeeperTypeSchema = z.enum(["REGULAR", "FRANCHISE"]);

export const CreateKeeperSchema = z.object({
  playerId: CuidSchema,
  type: KeeperTypeSchema.default("REGULAR"),
});

export const UpdateKeeperSchema = z.object({
  type: KeeperTypeSchema.optional(),
  isLocked: z.boolean().optional(),
});

export const OverrideKeeperSchema = z.object({
  rosterId: CuidSchema,
  playerId: CuidSchema,
  baseCost: z.number().int().min(1).max(20),
  type: KeeperTypeSchema.default("REGULAR"),
  reason: z.string().min(1).max(500),
});

// ============================================
// Trade schemas
// ============================================

export const TradeAssetSchema = z.object({
  type: z.enum(["player", "pick"]),
  playerId: CuidSchema.optional(),
  pickRound: z.number().int().min(1).max(20).optional(),
  pickYear: z.number().int().min(2020).max(2030).optional(),
});

export const TradePartySchema = z.object({
  rosterId: CuidSchema,
  assetsGiven: z.array(TradeAssetSchema),
  assetsReceived: z.array(TradeAssetSchema),
});

export const CreateTradeProposalSchema = z.object({
  parties: z.array(TradePartySchema).min(2).max(4),
  notes: z.string().max(1000).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const TradeVoteSchema = z.object({
  vote: z.enum(["ACCEPT", "REJECT"]),
  reason: z.string().max(500).optional(),
});

// ============================================
// Sync schemas
// ============================================

export const SyncActionSchema = z.enum([
  "league",
  "user-leagues",
  "quick",
  "populate-keepers",
  "recalculate-keeper-years",
  "sync-drafts-only",
  "sync-league-history",
  "sync-league-chain",
  "sync-traded-picks",
  "debug-keepers",
  "check-sleeper-keepers",
  "debug-traded-picks",
]);

export const SyncRequestSchema = z.object({
  action: SyncActionSchema,
  leagueId: CuidSchema.optional(),
  sleeperLeagueId: SleeperIdSchema.optional(),
  sleeperLeagueIds: z.array(SleeperIdSchema).optional(),
});

// ============================================
// Settings schemas
// ============================================

export const LeagueSettingsSchema = z.object({
  maxKeepers: z.number().int().min(0).max(10).optional(),
  maxFranchiseTags: z.number().int().min(0).max(3).optional(),
  keeperDeadline: z.string().datetime().optional(),
  franchiseTagEnabled: z.boolean().optional(),
  costIncrementPerYear: z.number().int().min(0).max(5).optional(),
});

export const KeeperSettingsSchema = z.object({
  maxKeepers: z.number().int().min(0).max(10),
  maxFranchiseTags: z.number().int().min(0).max(3),
  franchiseTagRound: z.number().int().min(1).max(5),
  costIncrementPerYear: z.number().int().min(0).max(5),
  minRoundForKeeper: z.number().int().min(1).max(16),
  allowSameRoundKeepers: z.boolean(),
});

// ============================================
// Notification schemas
// ============================================

export const NotificationTypeSchema = z.enum([
  "TRADE_PROPOSED",
  "TRADE_ACCEPTED",
  "TRADE_REJECTED",
  "TRADE_EXPIRED",
  "KEEPER_DEADLINE",
  "KEEPER_SELECTED",
  "SYSTEM",
]);

export const CreateNotificationSchema = z.object({
  userId: CuidSchema,
  type: NotificationTypeSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  link: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// Error log schemas
// ============================================

export const ErrorLogSchema = z.object({
  type: z.enum(["client_error", "handled_error", "api_error"]),
  message: z.string(),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  url: z.string().optional(),
  userAgent: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string(),
});

// ============================================
// Onboarding schemas
// ============================================

export const OnboardingActionSchema = z.object({
  action: z.enum(["complete", "skip"]),
});

// ============================================
// Commissioner schemas
// ============================================

export const CommissionerActionSchema = z.object({
  action: z.enum([
    "lock-keepers",
    "unlock-keepers",
    "force-sync",
    "override-keeper",
    "remove-keeper",
    "extend-deadline",
    "update-settings",
  ]),
  data: z.record(z.string(), z.unknown()).optional(),
});

// ============================================
// Helper function for validation
// ============================================

import { ValidationError } from "./errors";

/**
 * Validate request body against a Zod schema
 * Throws ValidationError if validation fails
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw ValidationError.fromZod(result.error);
  }
  return result.data;
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): T {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return validateBody(schema, params);
}

/**
 * Validate route params against a Zod schema
 */
export function validateParams<T>(
  schema: z.ZodSchema<T>,
  params: Record<string, string | string[]>
): T {
  return validateBody(schema, params);
}
