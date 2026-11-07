import type { Prisma } from "@prisma/client";

/**
 * Human-readable document numbers (MRN, appointment code, invoice number).
 *
 * Each generator looks up the highest number already issued for the current
 * period and adds one. They are always called inside the same transaction as
 * the insert, and the callers retry once on a unique-constraint clash, which
 * covers the rare case of two receptionists saving at the same instant.
 */

type Tx = Prisma.TransactionClient;

function pad(value: number, width = 4): string {
  return value.toString().padStart(width, "0");
}

function tailNumber(code: string | undefined, prefixLength: number): number {
  if (!code) return 0;
  const parsed = Number.parseInt(code.slice(prefixLength), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** e.g. "P-2026-0042" */
export async function nextMrn(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `P-${year}-`;
  const latest = await tx.patient.findFirst({
    where: { mrn: { startsWith: prefix } },
    orderBy: { mrn: "desc" },
    select: { mrn: true },
  });
  return `${prefix}${pad(tailNumber(latest?.mrn, prefix.length) + 1)}`;
}

/** e.g. "APT-20261108-0007" (restarts each day) */
export async function nextAppointmentCode(
  tx: Tx,
  scheduledAt: Date,
): Promise<string> {
  const stamp = [
    scheduledAt.getFullYear(),
    String(scheduledAt.getMonth() + 1).padStart(2, "0"),
    String(scheduledAt.getDate()).padStart(2, "0"),
  ].join("");
  const prefix = `APT-${stamp}-`;
  const latest = await tx.appointment.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  return `${prefix}${pad(tailNumber(latest?.code, prefix.length) + 1)}`;
}

/** e.g. "INV-2026-0031" */
export async function nextInvoiceNumber(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const latest = await tx.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return `${prefix}${pad(tailNumber(latest?.number, prefix.length) + 1)}`;
}

/**
 * Runs `operation`, retrying once if the database rejected a generated code
 * because another request claimed it first.
 */
export async function withCodeRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return operation();
    }
    throw error;
  }
}
