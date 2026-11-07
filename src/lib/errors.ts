import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

/**
 * Errors that are safe to show to the user. Anything that is not an AppError
 * is treated as an unexpected failure and reported generically so that stack
 * traces and database details never reach the browser.
 */
export class AppError extends Error {
  readonly fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "AppError";
    this.fieldErrors = fieldErrors;
  }
}

/** A record the user asked for does not exist (or is not visible to them). */
export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(`${entity} could not be found.`);
    this.name = "NotFoundError";
  }
}

/** A real-world rule was broken, e.g. double-booking a doctor. */
export class BusinessRuleError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message, fieldErrors);
    this.name = "BusinessRuleError";
  }
}

/** The signed-in user is not allowed to perform this action. */
export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Nobody is signed in. */
export class AuthenticationError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

// ---------------------------------------------------------------------------
// Server action result envelope
// ---------------------------------------------------------------------------

export type ActionSuccess<T> = {
  ok: true;
  data: T;
  message?: string;
};

export type ActionFailure = {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T = undefined> = ActionSuccess<T> | ActionFailure;

export function ok<T>(data: T, message?: string): ActionSuccess<T> {
  return { ok: true, data, message };
}

export function fail(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionFailure {
  return { ok: false, error, fieldErrors };
}

/**
 * Converts any thrown value into a user-facing ActionFailure. Known error
 * types keep their message; everything else is logged server-side and reported
 * as a generic failure.
 */
export function toActionFailure(error: unknown): ActionFailure {
  if (error instanceof ZodError) {
    const flattened = error.flatten();
    const firstIssue = error.issues[0]?.message ?? "Please check the form.";
    return fail(firstIssue, flattened.fieldErrors as Record<string, string[]>);
  }

  if (error instanceof AppError) {
    return fail(error.message, error.fieldErrors);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return fail(describePrismaError(error));
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error("[db] initialization error:", error.message);
    return fail(
      "Cannot reach the database right now. Please try again in a moment.",
    );
  }

  console.error("[unexpected]", error);
  return fail("Something went wrong. Please try again.");
}

function describePrismaError(
  error: Prisma.PrismaClientKnownRequestError,
): string {
  switch (error.code) {
    case "P2002": {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target.join(", ") : String(target ?? "value");
      return `That ${humanizeField(fields)} is already in use.`;
    }
    case "P2003":
      return "This record is linked to other records and cannot be changed.";
    case "P2025":
      return "The record you are trying to update no longer exists.";
    default:
      console.error("[db]", error.code, error.message);
      return "The database rejected this operation.";
  }
}

function humanizeField(field: string): string {
  return field
    .replace(/_key$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
}
