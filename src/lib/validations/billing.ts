import { z } from "zod";

import { cuid, optionalText } from "@/lib/validations/common";

export const invoiceItemSchema = z.object({
  serviceId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
  description: z
    .string()
    .trim()
    .min(2, "Describe what is being charged.")
    .max(160),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(100, "Quantity cannot exceed 100."),
  unitPrice: z.coerce
    .number()
    .min(0, "Price cannot be negative.")
    .max(1_000_000, "Price is unrealistically high."),
});

export const createInvoiceSchema = z
  .object({
    patientId: cuid,
    consultationId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined)),
    items: z
      .array(invoiceItemSchema)
      .min(1, "An invoice needs at least one line item."),
    discountAmount: z.coerce
      .number()
      .min(0, "Discount cannot be negative.")
      .default(0),
    taxAmount: z.coerce.number().min(0, "Tax cannot be negative.").default(0),
    notes: optionalText(500),
  })
  .refine(
    (data) => {
      const subtotal = data.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      return data.discountAmount <= subtotal;
    },
    {
      message: "Discount cannot be greater than the subtotal.",
      path: ["discountAmount"],
    },
  );

export const recordPaymentSchema = z.object({
  invoiceId: cuid,
  amount: z.coerce
    .number()
    .positive("Enter an amount greater than zero.")
    .max(1_000_000, "That amount is unrealistically high."),
  method: z
    .enum(["CASH", "CARD", "MOBILE_BANKING", "BANK_TRANSFER"])
    .default("CASH"),
  reference: optionalText(80),
  note: optionalText(200),
});

export const serviceSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "A short code is required.")
    .max(20)
    .regex(
      /^[A-Za-z0-9-]+$/,
      "Use letters, numbers and hyphens only (e.g. LAB-CBC).",
    )
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2, "Name is required.").max(120),
  category: z
    .enum(["CONSULTATION", "LAB_TEST", "PROCEDURE", "MEDICATION", "OTHER"])
    .default("OTHER"),
  price: z.coerce
    .number()
    .min(0, "Price cannot be negative.")
    .max(1_000_000, "Price is unrealistically high."),
  description: optionalText(300),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((value) =>
      typeof value === "boolean" ? value : value === "true" || value === "on",
    )
    .default(true),
});

export const updateServiceSchema = serviceSchema.extend({ id: cuid });

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
