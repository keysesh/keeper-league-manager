import { describe, it, expect } from "vitest";
import { ZodError, z } from "zod";
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  normalizeError,
  assert,
  assertExists,
  formatErrorForClient,
  isOperationalError,
} from "./errors";

describe("AppError", () => {
  it("creates error with all properties", () => {
    const error = new AppError("Test error", "TEST_ERROR", 400, {
      userId: "123",
    });

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_ERROR");
    expect(error.statusCode).toBe(400);
    expect(error.context).toEqual({ userId: "123" });
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe("AppError");
  });

  it("defaults to 500 status and operational true", () => {
    const error = new AppError("Test", "TEST");

    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
  });
});

describe("NotFoundError", () => {
  it("creates 404 error with resource name", () => {
    const error = new NotFoundError("User", "123");

    expect(error.message).toBe("User with ID '123' not found");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.context).toEqual({ resource: "User", id: "123" });
  });

  it("handles missing ID", () => {
    const error = new NotFoundError("User");

    expect(error.message).toBe("User not found");
  });
});

describe("ValidationError", () => {
  it("creates 400 error with field errors", () => {
    const error = new ValidationError("Validation failed", {
      email: ["Invalid email format"],
      password: ["Too short", "Must contain number"],
    });

    expect(error.message).toBe("Validation failed");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(400);
    expect(error.errors).toEqual({
      email: ["Invalid email format"],
      password: ["Too short", "Must contain number"],
    });
  });

  it("creates from ZodError", () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().positive(),
    });

    let zodError: ZodError | undefined;
    try {
      schema.parse({ email: "invalid", age: -1 });
    } catch (e) {
      zodError = e as ZodError;
    }

    const error = ValidationError.fromZod(zodError!);

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(400);
    expect(Object.keys(error.errors)).toContain("email");
    expect(Object.keys(error.errors)).toContain("age");
  });
});

describe("UnauthorizedError", () => {
  it("creates 401 error", () => {
    const error = new UnauthorizedError();

    expect(error.message).toBe("Unauthorized");
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.statusCode).toBe(401);
  });

  it("accepts custom message", () => {
    const error = new UnauthorizedError("Invalid token");

    expect(error.message).toBe("Invalid token");
  });
});

describe("ForbiddenError", () => {
  it("creates 403 error", () => {
    const error = new ForbiddenError();

    expect(error.message).toBe("Access denied");
    expect(error.code).toBe("FORBIDDEN");
    expect(error.statusCode).toBe(403);
  });
});

describe("ConflictError", () => {
  it("creates 409 error", () => {
    const error = new ConflictError("Email already exists");

    expect(error.message).toBe("Email already exists");
    expect(error.code).toBe("CONFLICT");
    expect(error.statusCode).toBe(409);
  });
});

describe("RateLimitError", () => {
  it("creates 429 error with retryAfter", () => {
    const error = new RateLimitError(120);

    expect(error.message).toBe("Too many requests");
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.statusCode).toBe(429);
    expect(error.retryAfter).toBe(120);
  });

  it("defaults retryAfter to 60", () => {
    const error = new RateLimitError();

    expect(error.retryAfter).toBe(60);
  });
});

describe("ExternalServiceError", () => {
  it("creates 502 error with service name", () => {
    const error = new ExternalServiceError("Sleeper", "API unavailable");

    expect(error.message).toBe("API unavailable");
    expect(error.code).toBe("EXTERNAL_SERVICE_ERROR");
    expect(error.statusCode).toBe(502);
    expect(error.service).toBe("Sleeper");
    expect(error.context?.service).toBe("Sleeper");
  });
});

describe("normalizeError", () => {
  it("returns AppError unchanged", () => {
    const original = new NotFoundError("User");
    const normalized = normalizeError(original);

    expect(normalized).toBe(original);
  });

  it("converts ZodError to ValidationError", () => {
    const schema = z.object({ name: z.string() });
    let zodError: ZodError | undefined;
    try {
      schema.parse({ name: 123 });
    } catch (e) {
      zodError = e as ZodError;
    }

    const normalized = normalizeError(zodError);

    expect(normalized).toBeInstanceOf(ValidationError);
  });

  it("converts generic Error to AppError", () => {
    const original = new Error("Something failed");
    const normalized = normalizeError(original);

    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized.message).toBe("Something failed");
    expect(normalized.code).toBe("INTERNAL_ERROR");
    expect(normalized.isOperational).toBe(false);
  });

  it("converts unknown to AppError", () => {
    const normalized = normalizeError("string error");

    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized.code).toBe("UNKNOWN_ERROR");
  });
});

describe("assert", () => {
  it("does not throw when condition is true", () => {
    expect(() => assert(true, "Should not throw")).not.toThrow();
  });

  it("throws when condition is false", () => {
    expect(() => assert(false, "Condition failed")).toThrow(AppError);
  });

  it("uses custom error class", () => {
    expect(() =>
      assert(false, "Not found", NotFoundError as typeof AppError)
    ).toThrow(NotFoundError);
  });
});

describe("assertExists", () => {
  it("does not throw for existing value", () => {
    const value = { id: "123" };
    expect(() => assertExists(value, "User")).not.toThrow();
  });

  it("throws NotFoundError for null", () => {
    expect(() => assertExists(null, "User", "123")).toThrow(NotFoundError);
  });

  it("throws NotFoundError for undefined", () => {
    expect(() => assertExists(undefined, "User")).toThrow(NotFoundError);
  });
});

describe("formatErrorForClient", () => {
  it("returns message from AppError", () => {
    const error = new NotFoundError("User");
    expect(formatErrorForClient(error)).toBe("User not found");
  });

  it("returns message from generic Error", () => {
    const error = new Error("Something went wrong");
    expect(formatErrorForClient(error)).toBe("Something went wrong");
  });

  it("returns generic message for unknown", () => {
    expect(formatErrorForClient("string")).toBe(
      "An unexpected error occurred. Please try again."
    );
  });
});

describe("isOperationalError", () => {
  it("returns true for operational AppError", () => {
    const error = new NotFoundError("User");
    expect(isOperationalError(error)).toBe(true);
  });

  it("returns false for non-operational error", () => {
    const error = new AppError("Bug", "BUG", 500, undefined, false);
    expect(isOperationalError(error)).toBe(false);
  });

  it("returns false for generic Error", () => {
    const error = new Error("Generic");
    expect(isOperationalError(error)).toBe(false);
  });
});
