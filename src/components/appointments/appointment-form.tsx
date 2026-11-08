"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Info, Loader2 } from "lucide-react";

import {
  createAppointmentAction,
  getDoctorSlotsAction,
  rescheduleAppointmentAction,
  type AppointmentActionState,
} from "@/actions/appointment.actions";
import type { SlotSuggestion } from "@/lib/services/appointment.service";
import type { BookableDoctorOption } from "@/lib/services/staff.service";
import type { PatientPickerOption } from "@/lib/services/patient.service";
import { APPOINTMENT_TYPE_OPTIONS, WEEKDAYS } from "@/lib/constants";
import { cn, formatClockTime, formatCurrency } from "@/lib/utils";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/states";
import { PatientPicker } from "@/components/patients/patient-picker";
import { useToast } from "@/components/ui/toast";

const DURATIONS = [15, 20, 30, 45, 60];

export type AppointmentFormDefaults = {
  id?: string;
  patient?: PatientPickerOption | null;
  doctorId?: string;
  date?: string;
  time?: string;
  durationMinutes?: number;
  type?: string;
  reason?: string;
  notes?: string | null;
};

export function AppointmentForm({
  mode,
  doctors,
  defaults = {},
  cancelHref = "/appointments",
}: {
  mode: "create" | "reschedule";
  doctors: BookableDoctorOption[];
  defaults?: AppointmentFormDefaults;
  cancelHref?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const action =
    mode === "create" ? createAppointmentAction : rescheduleAppointmentAction;
  const [state, formAction] = useActionState<AppointmentActionState, FormData>(
    action,
    null,
  );

  const [doctorId, setDoctorId] = React.useState(
    defaults.doctorId ?? doctors[0]?.id ?? "",
  );
  const [date, setDate] = React.useState(defaults.date ?? todayISO());
  const [duration, setDuration] = React.useState(
    defaults.durationMinutes ?? 30,
  );
  const [time, setTime] = React.useState(defaults.time ?? "");

  const [slots, setSlots] = React.useState<SlotSuggestion[]>([]);
  const [slotNote, setSlotNote] = React.useState<string | undefined>();
  const [slotsLoading, setSlotsLoading] = React.useState(false);

  const doctor = doctors.find((item) => item.id === doctorId);

  // Live availability: ask the server which slots are still free whenever the
  // doctor, day or visit length changes.
  React.useEffect(() => {
    if (!doctorId || !date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);

    (async () => {
      try {
        const result = await getDoctorSlotsAction(
          doctorId,
          date,
          duration,
          defaults.id,
        );
        if (cancelled) return;
        setSlots(result.slots);
        setSlotNote(result.note);
        // Drop a chosen time that is no longer offered.
        setTime((current) =>
          current && result.slots.some((slot) => slot.time === current && slot.available)
            ? current
            : "",
        );
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [doctorId, date, duration, defaults.id]);

  React.useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? "Saved.");
    router.push(`/appointments/${state.data.id}`);
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const topError = state && !state.ok ? state.error : undefined;

  const scheduledAt = time ? `${date}T${time}` : "";
  const availableCount = slots.filter((slot) => slot.available).length;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <input type="hidden" name="scheduledAt" value={scheduledAt} />
      <input type="hidden" name="durationMinutes" value={duration} />

      {topError ? (
        <Alert variant="error" title="Could not save this booking">
          {topError}
        </Alert>
      ) : null}

      {/* ---------------- who ---------------- */}
      <Card>
        <CardHeader
          title="Who is the visit for?"
          description="Search the registry, or register a new patient first."
        />
        <CardBody className="space-y-4">
          {mode === "create" ? (
            <Field
              label="Patient"
              htmlFor="patientId"
              required
              error={errors?.patientId}
            >
              <PatientPicker
                initialPatient={defaults.patient}
                invalid={Boolean(errors?.patientId)}
              />
            </Field>
          ) : (
            <Alert variant="info">
              Rescheduling keeps the same patient. Cancel the visit and book a
              new one to change who it is for.
            </Alert>
          )}

          <Field
            label="Doctor"
            htmlFor="doctorId"
            required
            error={errors?.doctorId}
          >
            <Select
              id="doctorId"
              name="doctorId"
              value={doctorId}
              onChange={(event) => setDoctorId(event.target.value)}
              required
              invalid={Boolean(errors?.doctorId)}
            >
              {doctors.length === 0 ? (
                <option value="">No doctors are accepting bookings</option>
              ) : null}
              {doctors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.user.name} — {item.specialization} (
                  {formatCurrency(item.consultationFee)})
                </option>
              ))}
            </Select>
          </Field>

          {doctor ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
              <Info className="h-3.5 w-3.5" aria-hidden />
              <span>
                Clinic days:{" "}
                {doctor.availableDays
                  .map(
                    (day) =>
                      WEEKDAYS.find((weekday) => weekday.value === day)?.short,
                  )
                  .filter(Boolean)
                  .join(", ")}
              </span>
              <span aria-hidden>·</span>
              <span>
                {formatClockTime(doctor.startTime)} –{" "}
                {formatClockTime(doctor.endTime)}
              </span>
              {doctor.roomNumber ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Room {doctor.roomNumber}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {/* ---------------- when ---------------- */}
      <Card>
        <CardHeader
          title="When?"
          description="Only free slots inside the doctor's working hours can be chosen."
          icon={<CalendarClock className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Date" htmlFor="date" required>
              <Input
                id="date"
                type="date"
                value={date}
                min={todayISO()}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </Field>

            <Field label="Visit length" htmlFor="duration" required>
              <Select
                id="duration"
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              >
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink-secondary">
                Available times
                <span className="ml-1 text-[var(--danger)]" aria-hidden>
                  *
                </span>
              </p>
              {slotsLoading ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  Checking the diary…
                </span>
              ) : slots.length > 0 ? (
                <span className="text-xs text-ink-muted">
                  {availableCount} of {slots.length} free
                </span>
              ) : null}
            </div>

            {slotNote ? (
              <Alert variant="warning">{slotNote}</Alert>
            ) : slots.length === 0 && !slotsLoading ? (
              <Alert variant="info">
                Pick a doctor and a date to see the available times.
              </Alert>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {slots.map((slot) => {
                  const active = time === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      title={slot.reason}
                      onClick={() => setTime(slot.time)}
                      aria-pressed={active}
                      className={cn(
                        "tabular rounded-[var(--radius-control)] border px-2 py-2 text-sm font-medium transition-colors duration-150",
                        active
                          ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--ink-inverse)]"
                          : slot.available
                            ? "border-line-strong text-ink hover:border-[var(--brand)] hover:bg-brand-soft"
                            : "cursor-not-allowed border-line bg-surface-muted text-ink-muted line-through",
                      )}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            )}

            {errors?.scheduledAt ? (
              <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
                {errors.scheduledAt[0]}
              </p>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {/* ---------------- why ---------------- */}
      <Card>
        <CardHeader title="Why?" description="Shown to the doctor in the queue." />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Visit type" htmlFor="type" required error={errors?.type}>
              <Select
                id="type"
                name="type"
                defaultValue={defaults.type ?? "NEW_VISIT"}
              >
                {APPOINTMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Reason for visit"
            htmlFor="reason"
            required
            error={errors?.reason}
          >
            <Textarea
              id="reason"
              name="reason"
              rows={2}
              defaultValue={defaults.reason ?? ""}
              placeholder="Fever and sore throat for three days"
              required
              invalid={Boolean(errors?.reason)}
            />
          </Field>

          <Field label="Front-desk notes" htmlFor="notes" error={errors?.notes}>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={defaults.notes ?? ""}
              placeholder="Optional — anything the doctor should know before the visit"
            />
          </Field>
        </CardBody>

        <CardFooter>
          <Link href={cancelHref} className={buttonClasses("secondary", "md")}>
            Cancel
          </Link>
          <SubmitButton pendingLabel="Checking availability…" disabled={!time}>
            {mode === "create" ? "Book visit" : "Save new time"}
          </SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
