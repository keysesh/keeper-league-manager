import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger } from "./logger";

/**
 * Error context for better debugging
 */
export interface ErrorContext {
  userId?: string;
  leagueId?: string;
  rosterId?: string;
  action?: string;
  resource?: string;
  [key: string]: unknown;
}

/**
 * Base application error with context
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: ErrorContext;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    context?: ErrorContext,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string, context?: ErrorContext) {
    const message = id
      ? `${resource} with ID '${id}' not found`
      : `${resource} not found`;
    super(message, "NOT_FOUND", 404, { ...context, resource, id });
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  public readonly errors: Record<string, string[]>;

  constructor(
    message: string,
    errors: Record<string, string[]> = {},
    context?: ErrorContext
  ) {
    super(message, "VALIDATION_ERROR", 400, context);
    this.errors = errors;
  }

  static fromZod(error: ZodError, context?: ErrorContext): ValidationError {
    const errors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join(".");
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(issue.message);
    }
    return new ValidationError("Validation failed", errors, context);
  }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized", context?: ErrorContext) {
    super(message, "UNAUTHORIZED", 401, context);
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Access denied", context?: ErrorContext) {
    super(message, "FORBIDDEN", 403, context);
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, "CONFLICT", 409, context);
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60, context?: ErrorContext) {
    super("Too many requests", "RATE_LIMITED", 429, context);
    this.retryAfter = retryAfter;
  }
}

/**
 * External service error (502)
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(service: string, message: string, context?: ErrorContext) {
    super(message, "EXTERNAL_SERVICE_ERROR", 502, { ...context, service });
    this.service = service;
  }
}

/**
 * Convert any error to an AppError
 */
export function normalizeError(error: unknown, context?: ErrorContext): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return ValidationError.fromZod(error, context);
  }

  if (error instanceof Error) {
    return new AppError(error.message, "INTERNAL_ERROR", 500, context, false);
  }

  return new AppError(
    "An unexpected error occurred",
    "UNKNOWN_ERROR",
    500,
    context,
    false
  );
}

/**
 * API error response format
 */
interface ApiErrorResponse {
  error: string;
  code: string;
  errors?: Record<string, string[]>;
  context?: ErrorContext;
}

/**
 * Create error response for API routes
 */
export function createErrorResponse(error: unknown, context?: ErrorContext): NextResponse {
  const appError = normalizeError(error, context);

  // Log the error
  logger.error(
    `[${appError.code}] ${appError.message}`,
    appError,
    appError.context
  );

  const response: ApiErrorResponse = {
    error: appError.message,
    code: appError.code,
  };

  // Include validation errors if present
  if (appError instanceof ValidationError) {
    response.errors = appError.errors;
  }

  // Only include context in development
  if (process.env.NODE_ENV === "development") {
    response.context = appError.context;
  }

  const headers: Record<string, string> = {};
  if (appError instanceof RateLimitError) {
    headers["Retry-After"] = String(appError.retryAfter);
  }

  return NextResponse.json(response, {
    status: appError.statusCode,
    headers,
  });
}

/**
 * Wrapper for API route handlers with error handling
 */
export function withErrorHandling<T extends Record<string, unknown>>(
  handler: (req: Request, context: T) => Promise<NextResponse>
): (req: Request, context: T) => Promise<NextResponse> {
  return async (req: Request, context: T) => {
    try {
      return await handler(req, context);
    } catch (error) {
      return createErrorResponse(error);
    }
  };
}

/**
 * Assert a condition or throw an error
 */
export function assert(
  condition: unknown,
  message: string,
  ErrorClass: typeof AppError = AppError,
  context?: ErrorContext
): asserts condition {
  if (!condition) {
    throw new ErrorClass(message, "ASSERTION_FAILED", 500, context);
  }
}

/**
 * Assert that a value is not null/undefined
 */
export function assertExists<T>(
  value: T | null | undefined,
  resource: string,
  id?: string,
  context?: ErrorContext
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resource, id, context);
  }
}

/**
 * Safe async function wrapper that catches and logs errors
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  fallback: T,
  context?: ErrorContext
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const appError = normalizeError(error, context);
    logger.error(`[tryCatch] ${appError.message}`, appError, context);
    return fallback;
  }
}

/**
 * Format error for client display
 */
export function formatErrorForClient(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Check if error is operational (expected) vs programming error
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}
