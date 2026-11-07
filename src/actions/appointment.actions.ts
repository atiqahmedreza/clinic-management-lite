"use server";

import { revalidatePath } from "next/cache";
import type { AppointmentStatus } from "@prisma/client";

import { requireRole, requireUser } from "@/lib/auth/session";
import { ok, toActionFailure, type ActionResult } from "@/lib/errors";
import {
  changeAppointmentStatus,
  createAppointment,
  getDoctorDaySlots,
  rescheduleAppointment,
  type SlotSuggestion,
} from "@/lib/services/appointment.service";
import {
  cancelAppointmentSchema,
  changeStatusSchema,
  createAppointmentSchema,
  rescheduleAppointmentSchema,
} from "@/lib/validations/appointment";
import { formToObject } from "@/actions/helpers";

export type AppointmentActionState = ActionResult<{
  id: string;
  code: string;
}> | null;

function revalidateAppointment(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/appointments");
  if (id) revalidatePath(`/appointments/${id}`);
}

export async function createAppointmentAction(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  try {
    const session = await requireRole("RECEPTIONIST", "DOCTOR");
    const input = createAppointmentSchema.parse(formToObject(formData));
    const appointment = await createAppointment(input, session.sub);

    revalidateAppointment(appointment.id);
    revalidatePath("/patients");

    return ok(
      { id: appointment.id, code: appointment.code },
      `Visit ${appointment.code} booked.`,
    );
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function rescheduleAppointmentAction(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  try {
    await requireRole("RECEPTIONIST", "DOCTOR");
    const input = rescheduleAppointmentSchema.parse(formToObject(formData));
    const appointment = await rescheduleAppointment(input);

    revalidateAppointment(appointment.id);

    return ok(
      { id: appointment.id, code: appointment.code },
      `Visit ${appointment.code} rescheduled.`,
    );
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function changeAppointmentStatusAction(
  id: string,
  status: AppointmentStatus,
): Promise<ActionResult<{ id: string; status: AppointmentStatus }>> {
  try {
    await requireUser();
    const input = changeStatusSchema.parse({ id, status });
    const result = await changeAppointmentStatus(input.id, input.status);

    revalidateAppointment(result.id);

    return ok(
      { id: result.id, status: result.status },
      `${result.code} marked as ${result.status.toLowerCase().replace("_", " ")}.`,
    );
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function cancelAppointmentAction(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  try {
    await requireRole("RECEPTIONIST", "DOCTOR");
    const input = cancelAppointmentSchema.parse(formToObject(formData));
    const result = await changeAppointmentStatus(input.id, "CANCELLED", {
      cancellationReason: input.cancellationReason,
    });

    revalidateAppointment(result.id);

    return ok({ id: result.id, code: result.code }, `${result.code} cancelled.`);
  } catch (error) {
    return toActionFailure(error);
  }
}

/** Live slot availability for the booking form's time picker. */
export async function getDoctorSlotsAction(
  doctorId: string,
  dateISO: string,
  durationMinutes: number,
  excludeAppointmentId?: string,
): Promise<{ slots: SlotSuggestion[]; working: boolean; note?: string }> {
  await requireUser();
  if (!doctorId || !dateISO) return { slots: [], working: false };
  const day = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(day.getTime())) return { slots: [], working: false };
  return getDoctorDaySlots(doctorId, day, durationMinutes, excludeAppointmentId);
}
