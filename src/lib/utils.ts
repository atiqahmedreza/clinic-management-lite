import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  differenceInYears,
  format,
  formatDistanceToNowStrict,
  isToday,
  isTomorrow,
  isYesterday,
} from "date-fns";
import { CURRENCY_SYMBOL } from "@/lib/constants";

/** Merge Tailwind class names, with later classes winning conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCurrency(amount: number | null | undefined): string {
  return `${CURRENCY_SYMBOL}${numberFormatter.format(amount ?? 0)}`;
}

export function formatCurrencyCompact(amount: number | null | undefined): string {
  const value = amount ?? 0;
  if (Math.abs(value) < 10_000) return formatCurrency(value);
  return `${CURRENCY_SYMBOL}${compactFormatter.format(value)}`;
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

// ---------------------------------------------------------------------------
// Dates & times
// ---------------------------------------------------------------------------

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy");
}

export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "EEEE, dd MMMM yyyy");
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "h:mm a");
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy, h:mm a");
}

/** "Today, 2:30 PM" / "Tomorrow, 9:00 AM" / "12 Nov 2026, 9:00 AM" */
export function formatFriendlyDateTime(
  date: Date | string | null | undefined,
): string {
  if (!date) return "—";
  const value = new Date(date);
  const time = format(value, "h:mm a");
  if (isToday(value)) return `Today, ${time}`;
  if (isTomorrow(value)) return `Tomorrow, ${time}`;
  if (isYesterday(value)) return `Yesterday, ${time}`;
  return `${format(value, "dd MMM yyyy")}, ${time}`;
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return `${formatDistanceToNowStrict(new Date(date))} ago`;
}

/** Value for an `<input type="date">`. */
export function toDateInputValue(
  date: Date | string | null | undefined,
): string {
  if (!date) return "";
  return format(new Date(date), "yyyy-MM-dd");
}

/** Value for an `<input type="datetime-local">`. */
export function toDateTimeInputValue(
  date: Date | string | null | undefined,
): string {
  if (!date) return "";
  return format(new Date(date), "yyyy-MM-dd'T'HH:mm");
}

export function calculateAge(dateOfBirth: Date | string): number {
  return differenceInYears(new Date(), new Date(dateOfBirth));
}

/** "32 y · Female" style descriptor used in list rows. */
export function describeAge(dateOfBirth: Date | string): string {
  const years = calculateAge(dateOfBirth);
  return years > 0 ? `${years} yrs` : "< 1 yr";
}

/** Parse "HH:mm" into minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number.parseInt(hours, 10) * 60 + Number.parseInt(minutes, 10);
}

/** Format minutes since midnight back into "HH:mm". */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Convert a 24h "HH:mm" into a display value such as "9:00 AM". */
export function formatClockTime(time: string): string {
  const minutes = timeToMinutes(time);
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${mins.toString().padStart(2, "0")} ${suffix}`;
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ---------------------------------------------------------------------------
// People & text
// ---------------------------------------------------------------------------

export function fullName(person: {
  firstName: string;
  lastName: string;
}): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function truncate(value: string, max = 80): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Deterministic colour index for an avatar, so the same person always gets the
 * same colour without storing one.
 */
export function colorIndex(seed: string, buckets: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  return hash % buckets;
}

// ---------------------------------------------------------------------------
// Query string helpers (used by searchable / filterable lists)
// ---------------------------------------------------------------------------

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export function readParam(
  params: SearchParamsInput,
  key: string,
): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  const trimmed = single?.trim();
  return trimmed ? trimmed : undefined;
}

export function readPage(params: SearchParamsInput, key = "page"): number {
  const raw = readParam(params, key);
  const page = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function buildQuery(
  current: SearchParamsInput,
  changes: Record<string, string | number | undefined | null>,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single) next.set(key, single);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === null || value === "") {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }
  const query = next.toString();
  return query ? `?${query}` : "";
}
