import { z } from "zod";

import {
  optionalEmail,
  optionalPhoneNumber,
  optionalText,
  phoneNumber,
} from "@/lib/validations/common";

const MAX_AGE_YEARS = 120;

export const patientSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "First name must be at least 2 characters.")
    .max(50, "First name is too long."),
  lastName: z
    .string()
    .trim()
    .min(2, "Last name must be at least 2 characters.")
    .max(50, "Last name is too long."),
  dateOfBirth: z
    .string()
    .min(1, "Date of birth is required.")
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Enter a valid date of birth.",
    })
    .transform((value) => new Date(`${value.slice(0, 10)}T00:00:00.000Z`))
    .refine((date) => date.getTime() <= Date.now(), {
      message: "Date of birth cannot be in the future.",
    })
    .refine(
      (date) => {
        const oldest = new Date();
        oldest.setFullYear(oldest.getFullYear() - MAX_AGE_YEARS);
        return date.getTime() >= oldest.getTime();
      },
      { message: `Date of birth cannot be more than ${MAX_AGE_YEARS} years ago.` },
    ),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], {
    errorMap: () => ({ message: "Select a gender." }),
  }),
  phone: phoneNumber,
  email: optionalEmail,
  address: optionalText(200),
  city: optionalText(60),
  bloodGroup: z
    .enum([
      "A_POSITIVE",
      "A_NEGATIVE",
      "B_POSITIVE",
      "B_NEGATIVE",
      "AB_POSITIVE",
      "AB_NEGATIVE",
      "O_POSITIVE",
      "O_NEGATIVE",
      "UNKNOWN",
    ])
    .default("UNKNOWN"),
  allergies: optionalText(300),
  chronicConditions: optionalText(300),
  emergencyContactName: optionalText(80),
  emergencyContactPhone: optionalPhoneNumber,
});

export const updatePatientSchema = patientSchema.extend({
  id: z.string().min(1),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((value) =>
      typeof value === "boolean" ? value : value === "true" || value === "on",
    )
    .default(true),
});

export type PatientInput = z.infer<typeof patientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
