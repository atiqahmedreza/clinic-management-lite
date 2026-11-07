"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/session";
import { ok, toActionFailure, type ActionResult } from "@/lib/errors";
import {
  saveConsultation,
  startConsultation,
} from "@/lib/services/consultation.service";
import {
  consultationSchema,
  type PrescriptionInput,
} from "@/lib/validations/consultation";
import { formToObject, readJsonField } from "@/actions/helpers";

export type ConsultationActionState = ActionResult<{ id: string }> | null;

export async function startConsultationAction(
  appointmentId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole("DOCTOR");
    const result = await startConsultation(appointmentId, session);

    revalidatePath("/dashboard");
    revalidatePath("/appointments");
    revalidatePath(`/appointments/${appointmentId}`);

    return ok({ id: result.id }, "Consultation started.");
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function saveConsultationAction(
  _prev: ConsultationActionState,
  formData: FormData,
): Promise<ConsultationActionState> {
  try {
    const session = await requireRole("DOCTOR");

    const input = consultationSchema.parse({
      ...formToObject(formData),
      prescriptions: readJsonField<PrescriptionInput[]>(
        formData,
        "prescriptions",
        [],
      ),
    });

    const consultation = await saveConsultation(input, session);

    revalidatePath("/dashboard");
    revalidatePath("/appointments");
    revalidatePath(`/appointments/${input.appointmentId}`);
    revalidatePath("/consultations");
    revalidatePath(`/consultations/${consultation.id}`);
    revalidatePath("/patients");

    return ok(
      { id: consultation.id },
      "Consultation saved and the visit is now complete.",
    );
  } catch (error) {
    return toActionFailure(error);
  }
}
