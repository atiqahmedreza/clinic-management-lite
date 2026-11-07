import { z } from "zod";

/**
 * HTML forms submit empty inputs as `""`. These helpers normalise that to
 * `undefined` so optional database columns stay NULL instead of storing blanks.
 */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .optional()
    .transform((value) => (value ? value : undefined));

export const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine(
    (value) => value === undefined || z.string().email().safeParse(value).success,
    { message: "Enter a valid email address." },
  );

export const optionalNumber = (options: {
  min: number;
  max: number;
  label: string;
}) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) return undefined;
      if (typeof value === "string" && value.trim() === "") return undefined;
      const parsed = Number(value);
      return Number.isNaN(parsed) ? Number.NaN : parsed;
    })
    .refine((value) => value === undefined || !Number.isNaN(value), {
      message: `${options.label} must be a number.`,
    })
    .refine(
      (value) =>
        value === undefined || (value >= options.min && value <= options.max),
      {
        message: `${options.label} must be between ${options.min} and ${options.max}.`,
      },
    );

export const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine(
    (value) => value === undefined || !Number.isNaN(Date.parse(value)),
    { message: "Enter a valid date." },
  )
  .transform((value) => (value ? new Date(value) : undefined));

export const cuid = z.string().min(1, "This field is required.");

/** Bangladeshi mobile number, with or without the country code. */
export const phoneNumber = z
  .string()
  .trim()
  .min(1, "Phone number is required.")
  .regex(
    /^(?:\+?880|0)1[3-9]\d{8}$/,
    "Enter a valid mobile number, e.g. 01712345678.",
  )
  .transform(normalisePhone);

export const optionalPhoneNumber = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine(
    (value) =>
      value === undefined || /^(?:\+?880|0)1[3-9]\d{8}$/.test(value),
    { message: "Enter a valid mobile number, e.g. 01712345678." },
  )
  .transform((value) => (value ? normalisePhone(value) : undefined));

/** Store every number in the same shape so uniqueness checks actually work. */
export function normalisePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("880")) return `0${digits.slice(3)}`;
  if (digits.startsWith("1") && digits.length === 10) return `0${digits}`;
  return digits;
}

export const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time such as 09:30.");

/** Converts a Zod error into the `fieldErrors` shape server actions return. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}
