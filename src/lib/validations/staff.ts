import { z } from "zod";

import {
  clockTime,
  cuid,
  optionalPhoneNumber,
  optionalText,
} from "@/lib/validations/common";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address.")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Password is required."),
});

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password is too long.")
  .regex(/[A-Za-z]/, "Password must contain a letter.")
  .regex(/\d/, "Password must contain a number.");

const doctorProfileSchema = z.object({
  specialization: z
    .string()
    .trim()
    .min(2, "Specialization is required.")
    .max(80),
  qualifications: z
    .string()
    .trim()
    .min(2, "Qualifications are required.")
    .max(120),
  licenseNumber: z
    .string()
    .trim()
    .min(3, "License number is required.")
    .max(40),
  consultationFee: z.coerce
    .number()
    .min(0, "Fee cannot be negative.")
    .max(100_000, "Fee is unrealistically high."),
  roomNumber: optionalText(20),
  bio: optionalText(400),
  availableDays: z
    .array(z.coerce.number().int().min(1).max(7))
    .min(1, "Select at least one working day."),
  startTime: clockTime,
  endTime: clockTime,
  slotMinutes: z.coerce
    .number()
    .int()
    .min(10, "Slots must be at least 10 minutes.")
    .max(120, "Slots cannot exceed 2 hours."),
  isAcceptingPatients: z
    .union([z.boolean(), z.string()])
    .transform((value) =>
      typeof value === "boolean" ? value : value === "true" || value === "on",
    )
    .default(true),
});

const baseStaffSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(80),
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address.")
    .transform((value) => value.toLowerCase()),
  phone: optionalPhoneNumber,
  role: z.enum(["ADMIN", "DOCTOR", "RECEPTIONIST"]),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((value) =>
      typeof value === "boolean" ? value : value === "true" || value === "on",
    )
    .default(true),
  doctor: doctorProfileSchema.optional(),
});

function requireDoctorProfile<T extends { role: string; doctor?: unknown }>(
  data: T,
  ctx: z.RefinementCtx,
) {
  if (data.role === "DOCTOR" && !data.doctor) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Doctor accounts need a clinical profile.",
      path: ["doctor"],
    });
  }
}

export const createStaffSchema = baseStaffSchema
  .extend({ password })
  .superRefine(requireDoctorProfile);

export const updateStaffSchema = baseStaffSchema
  .extend({
    id: cuid,
    password: z
      .string()
      .optional()
      .transform((value) => (value ? value : undefined))
      .refine(
        (value) => value === undefined || password.safeParse(value).success,
        {
          message:
            "New password must be at least 8 characters and include a letter and a number.",
        },
      ),
  })
  .superRefine(requireDoctorProfile);

export const doctorAvailabilitySchema = doctorProfileSchema
  .pick({
    availableDays: true,
    startTime: true,
    endTime: true,
    slotMinutes: true,
    isAcceptingPatients: true,
    consultationFee: true,
  })
  .extend({ id: cuid })
  .refine(
    (data) => data.startTime < data.endTime,
    { message: "Closing time must be after opening time.", path: ["endTime"] },
  );

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
