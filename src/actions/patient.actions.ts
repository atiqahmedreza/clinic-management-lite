"use server";

import { revalidatePath } from "next/cache";

import { requireRole, requireUser } from "@/lib/auth/session";
import { ok, toActionFailure, type ActionResult } from "@/lib/errors";
import {
  createPatient,
  searchPatientsForPicker,
  updatePatient,
  type PatientPickerOption,
} from "@/lib/services/patient.service";
import { patientSchema, updatePatientSchema } from "@/lib/validations/patient";
import { formToObject } from "@/actions/helpers";

export type PatientActionState = ActionResult<{
  id: string;
  mrn: string;
  name: string;
}> | null;

export async function createPatientAction(
  _prev: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  try {
    const session = await requireRole("RECEPTIONIST", "DOCTOR");
    const input = patientSchema.parse(formToObject(formData));
    const patient = await createPatient(input, session.sub);

    revalidatePath("/patients");
    revalidatePath("/dashboard");

    return ok(
      {
        id: patient.id,
        mrn: patient.mrn,
        name: `${patient.firstName} ${patient.lastName}`,
      },
      `${patient.firstName} ${patient.lastName} registered as ${patient.mrn}.`,
    );
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function updatePatientAction(
  _prev: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  try {
    await requireRole("RECEPTIONIST", "DOCTOR");
    const raw = formToObject(formData);
    const input = updatePatientSchema.parse({
      ...raw,
      isActive: formData.get("isActive") === "on" || raw.isActive === "true",
    });
    const patient = await updatePatient(input);

    revalidatePath("/patients");
    revalidatePath(`/patients/${patient.id}`);
    revalidatePath("/dashboard");

    return ok(
      {
        id: patient.id,
        mrn: patient.mrn,
        name: `${patient.firstName} ${patient.lastName}`,
      },
      "Patient record updated.",
    );
  } catch (error) {
    return toActionFailure(error);
  }
}

/** Used by the patient combobox on the booking form. */
export async function searchPatientsAction(
  term: string,
): Promise<PatientPickerOption[]> {
  await requireUser();
  return searchPatientsForPicker(term);
}
