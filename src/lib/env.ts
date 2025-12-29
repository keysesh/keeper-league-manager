/**
 * Environment Variable Validation
 * Ensures all required environment variables are present at startup
 */

import { z } from "zod";

const envSchema = z.object({
  // Database (required)
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .url("DATABASE_URL must be a valid URL"),

  // NextAuth (required)
  NEXTAUTH_URL: z
    .string()
    .min(1, "NEXTAUTH_URL is required")
    .url("NEXTAUTH_URL must be a valid URL"),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters"),

  // Sleeper API (optional, has default)
  SLEEPER_API_BASE_URL: z
    .string()
    .url()
    .default("https://api.sleeper.app/v1"),

  // Feature flags (optional)
  ENABLE_TRADE_ANALYZER: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  ENABLE_HISTORICAL_ANALYTICS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  // Logging (optional)
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),

  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Validate and return environment variables
 * Throws an error if required variables are missing
 */
export function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Environment validation failed:\n${errors}\n\nPlease check your .env.local file.`
    );
  }

  validatedEnv = result.data;
  return validatedEnv;
}

/**
 * Get validated environment (call validateEnv first)
 */
export function getEnv(): Env {
  if (!validatedEnv) {
    return validateEnv();
  }
  return validatedEnv;
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}

/**
 * Check if we're in development
 */
export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === "development";
}
