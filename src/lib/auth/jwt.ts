import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@prisma/client";

/**
 * Edge-safe token helpers. This module must not import Prisma, bcrypt or
 * `next/headers` because it is used by `middleware.ts`, which runs on the Edge
 * runtime.
 */

export const SESSION_COOKIE = "clinic_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: Role;
  /** Present only for users who have a doctor profile. */
  doctorId?: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set it in your environment (see .env.example).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer("clinic-management-lite")
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "clinic-management-lite",
    });
    if (!payload.sub || typeof payload.role !== "string") return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: payload.role as Role,
      doctorId:
        typeof payload.doctorId === "string" ? payload.doctorId : undefined,
    };
  } catch {
    // Expired, tampered with, or signed by a different secret.
    return null;
  }
}
