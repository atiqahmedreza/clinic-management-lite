import { Prisma } from "@prisma/client";

/**
 * Prisma returns `Decimal` objects for NUMERIC columns. Those cannot cross the
 * server/client boundary in a React Server Components payload, so every record
 * leaving the service layer is passed through `serialize`, which rewrites
 * Decimals as plain numbers and leaves Dates, primitives and nulls untouched.
 */
export type Serialized<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? Date
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

export function serialize<T>(value: T): Serialized<T> {
  return convert(value) as Serialized<T>;
}

function convert(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (Prisma.Decimal.isDecimal(value)) {
    return (value as Prisma.Decimal).toNumber();
  }

  if (value instanceof Date) return value;

  if (Array.isArray(value)) return value.map(convert);

  if (typeof value === "object" && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = convert(item);
    }
    return out;
  }

  return value;
}

/** Coerce a Decimal | number | null into a plain number. */
export function toNumber(
  value: Prisma.Decimal | number | string | null | undefined,
): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value) || 0;
  return value.toNumber();
}

/** Round to 2 decimal places, avoiding floating point drift on money math. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
