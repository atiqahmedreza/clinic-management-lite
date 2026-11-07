"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/session";
import { ok, toActionFailure, type ActionResult } from "@/lib/errors";
import { createStaff, updateStaff } from "@/lib/services/staff.service";
import { createStaffSchema, updateStaffSchema } from "@/lib/validations/staff";
import { formToObject, readAll } from "@/actions/helpers";

export type StaffActionState = ActionResult<{ id: string; name: string }> | null;

function buildPayload(formData: FormData) {
  const raw = formToObject(formData);
  const role = String(raw.role ?? "");

  const doctor =
    role === "DOCTOR"
      ? {
          specialization: raw.specialization,
          qualifications: raw.qualifications,
          licenseNumber: raw.licenseNumber,
          consultationFee: raw.consultationFee,
          roomNumber: raw.roomNumber,
          bio: raw.bio,
          availableDays: readAll(formData, "availableDays"),
          startTime: raw.startTime,
          endTime: raw.endTime,
          slotMinutes: raw.slotMinutes,
          isAcceptingPatients: formData.get("isAcceptingPatients") === "on",
        }
      : undefined;

  return {
    ...raw,
    isActive: formData.get("isActive") === "on",
    doctor,
  };
}

export async function saveStaffAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  try {
    const session = await requireRole("ADMIN");
    const payload = buildPayload(formData);
    const id = formData.get("id");

    if (typeof id === "string" && id.length > 0) {
      const input = updateStaffSchema.parse({ ...payload, id });
      const user = await updateStaff(input, session.sub);
      revalidatePath("/staff");
      revalidatePath("/doctors");
      return ok({ id: user.id, name: user.name }, `${user.name}'s account updated.`);
    }

    const input = createStaffSchema.parse(payload);
    const user = await createStaff(input);
    revalidatePath("/staff");
    revalidatePath("/doctors");
    return ok({ id: user.id, name: user.name }, `${user.name} can now sign in.`);
  } catch (error) {
    return toActionFailure(error);
  }
}
