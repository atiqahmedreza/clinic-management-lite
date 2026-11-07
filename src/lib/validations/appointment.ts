import { z } from "zod";

import { cuid, optionalText } from "@/lib/validations/common";

/** Bookings may be made at most this far ahead. */
const MAX_DAYS_AHEAD = 180;
/** Small tolerance so a booking made "right now" is not rejected. */
const PAST_TOLERANCE_MS = 60 * 1000;

const scheduledAt = z
  .string()
  .min(1, "Choose a date and time.")
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Enter a valid date and time.",
  })
  .transform((value) => new Date(value));

export const createAppointmentSchema = z.object({
  patientId: cuid,
  doctorId: cuid,
  scheduledAt: scheduledAt
    .refine((date) => date.getTime() > Date.now() - PAST_TOLERANCE_MS, {
      message: "Appointments cannot be booked in the past.",
    })
    .refine(
      (date) =>
        date.getTime() <= Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000,
      { message: `Appointments can only be booked up to ${MAX_DAYS_AHEAD} days ahead.` },
    ),
  durationMinutes: z.coerce
    .number()
    .int("Duration must be a whole number of minutes.")
    .min(10, "A visit must be at least 10 minutes.")
    .max(180, "A visit cannot be longer than 3 hours.")
    .default(30),
  type: z.enum(["NEW_VISIT", "FOLLOW_UP", "EMERGENCY"]).default("NEW_VISIT"),
  reason: z
    .string()
    .trim()
    .min(3, "Describe the reason for the visit (at least 3 characters).")
    .max(300, "Keep the reason under 300 characters."),
  notes: optionalText(500),
});

/** Rescheduling allows editing an existing booking without re-entering it. */
export const rescheduleAppointmentSchema = z.object({
  id: cuid,
  scheduledAt: scheduledAt.refine(
    (date) => date.getTime() > Date.now() - PAST_TOLERANCE_MS,
    { message: "A visit cannot be moved into the past." },
  ),
  durationMinutes: z.coerce.number().int().min(10).max(180).default(30),
  doctorId: cuid,
  reason: z.string().trim().min(3).max(300),
  type: z.enum(["NEW_VISIT", "FOLLOW_UP", "EMERGENCY"]),
  notes: optionalText(500),
});

export const cancelAppointmentSchema = z.object({
  id: cuid,
  cancellationReason: z
    .string()
    .trim()
    .min(3, "Give a short reason for the cancellation.")
    .max(200),
});

export const changeStatusSchema = z.object({
  id: cuid,
  status: z.enum([
    "SCHEDULED",
    "CHECKED_IN",
    "IN_CONSULTATION",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
  ]),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<
  typeof rescheduleAppointmentSchema
>;
