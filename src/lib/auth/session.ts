import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth/jwt";
import { AuthorizationError } from "@/lib/errors";

export type { SessionPayload };

/**
 * Reads and verifies the session cookie. Wrapped in `cache` so that a single
 * request which renders several server components only verifies the JWT once.
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
});

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Guard for server components: returns the session or sends the visitor to the
 * login page. Pages inside the authenticated layout rely on this.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Guard for server actions: throws instead of redirecting. */
export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthorizationError("Your session has expired. Please sign in again.");
  }
  return session;
}

/**
 * Role check used by both pages and actions. Admins implicitly pass every
 * check so that one account can always demonstrate the whole workflow.
 */
export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await requireUser();
  if (session.role === "ADMIN" || roles.includes(session.role)) {
    return session;
  }
  throw new AuthorizationError(
    `This action is restricted to ${roles.map(humanRole).join(" and ")} accounts.`,
  );
}

export function can(session: SessionPayload | null, ...roles: Role[]): boolean {
  if (!session) return false;
  return session.role === "ADMIN" || roles.includes(session.role);
}

function humanRole(role: Role): string {
  return role === "RECEPTIONIST"
    ? "receptionist"
    : role === "DOCTOR"
      ? "doctor"
      : "administrator";
}
