import { z } from "zod";

import {
  cuid,
  optionalDate,
  optionalNumber,
  optionalText,
} from "@/lib/validations/common";

export const prescriptionSchema = z.object({
  medicineName: z
    .string()
    .trim()
    .min(2, "Medicine name is required.")
    .max(120),
  dosage: z.string().trim().min(1, "Dosage is required.").max(60),
  frequency: z.string().trim().min(1, "Frequency is required.").max(60),
  durationDays: z.coerce
    .number()
    .int("Duration must be a whole number of days.")
    .min(1, "Duration must be at least 1 day.")
    .max(365, "Duration cannot exceed one year."),
  instructions: optionalText(200),
});

export const consultationSchema = z
  .object({
    appointmentId: cuid,

    // Vitals - optional, but each is range-checked when supplied so that a
    // mistyped value never reaches the medical record.
    temperatureC: optionalNumber({ min: 30, max: 45, label: "Temperature" }),
    pulseBpm: optionalNumber({ min: 20, max: 250, label: "Pulse" }),
    systolicBp: optionalNumber({ min: 50, max: 300, label: "Systolic pressure" }),
    diastolicBp: optionalNumber({ min: 30, max: 200, label: "Diastolic pressure" }),
    respiratoryBpm: optionalNumber({ min: 5, max: 80, label: "Respiratory rate" }),
    spo2: optionalNumber({ min: 50, max: 100, label: "SpO2" }),
    weightKg: optionalNumber({ min: 1, max: 400, label: "Weight" }),
    heightCm: optionalNumber({ min: 20, max: 250, label: "Height" }),

    symptoms: z
      .string()
      .trim()
      .min(3, "Record the presenting symptoms.")
      .max(1000),
    examination: optionalText(1000),
    diagnosis: z
      .string()
      .trim()
      .min(3, "A diagnosis is required to complete the consultation.")
      .max(500),
    treatmentPlan: optionalText(1000),
    advice: optionalText(1000),
    followUpDate: optionalDate,

    prescriptions: z.array(prescriptionSchema).max(20).default([]),
  })
  .refine(
    (data) =>
      data.systolicBp === undefined ||
      data.diastolicBp === undefined ||
      data.systolicBp > data.diastolicBp,
    {
      message: "Systolic pressure must be higher than diastolic pressure.",
      path: ["systolicBp"],
    },
  )
  .refine(
    (data) => {
      if (!data.followUpDate) return true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return data.followUpDate.getTime() >= today.getTime();
    },
    {
      message: "The follow-up date cannot be in the past.",
      path: ["followUpDate"],
    },
  );

export type ConsultationInput = z.infer<typeof consultationSchema>;
export type PrescriptionInput = z.infer<typeof prescriptionSchema>;
