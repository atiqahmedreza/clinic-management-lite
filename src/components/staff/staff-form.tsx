"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { saveStaffAction, type StaffActionState } from "@/actions/staff.actions";
import { ROLE_OPTIONS, WEEKDAYS } from "@/lib/constants";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
  ToggleChip,
} from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

export type StaffFormValues = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string | null;
  role?: string;
  isActive?: boolean;
  doctor?: {
    specialization?: string;
    qualifications?: string;
    licenseNumber?: string;
    consultationFee?: number;
    roomNumber?: string | null;
    bio?: string | null;
    availableDays?: number[];
    startTime?: string;
    endTime?: string;
    slotMinutes?: number;
    isAcceptingPatients?: boolean;
  } | null;
};

export function StaffForm({
  defaults,
  onDone,
}: {
  defaults?: StaffFormValues;
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState<StaffActionState, FormData>(
    saveStaffAction,
    null,
  );

  const editing = Boolean(defaults?.id);
  const [role, setRole] = React.useState(defaults?.role ?? "RECEPTIONIST");
  const [days, setDays] = React.useState<number[]>(
    defaults?.doctor?.availableDays ?? [1, 2, 3, 4, 5],
  );

  React.useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? "Saved.");
    if (!editing) {
      formRef.current?.reset();
      setRole("RECEPTIONIST");
      setDays([1, 2, 3, 4, 5]);
    }
    router.refresh();
    onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const topError = state && !state.ok ? state.error : undefined;

  const toggleDay = (value: number) =>
    setDays((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : [...current, value].sort((a, b) => a - b),
    );

  return (
    <Card>
      <CardHeader
        title={editing ? `Edit ${defaults?.name}` : "Add a staff account"}
        description={
          editing
            ? "Leave the password blank to keep the current one."
            : "The account can sign in as soon as it is created."
        }
      />
      <form ref={formRef} action={formAction} noValidate>
        {defaults?.id ? (
          <input type="hidden" name="id" value={defaults.id} />
        ) : null}
        {role === "DOCTOR"
          ? days.map((day) => (
              <input key={day} type="hidden" name="availableDays" value={day} />
            ))
          : null}

        <CardBody className="space-y-4">
          {topError ? (
            <Alert variant="error" title="Could not save this account">
              {topError}
            </Alert>
          ) : null}

          <Field label="Full name" htmlFor="name" required error={errors?.name}>
            <Input
              id="name"
              name="name"
              defaultValue={defaults?.name ?? ""}
              placeholder="Dr. Farhana Rahman"
              required
              invalid={Boolean(errors?.name)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="email" required error={errors?.email}>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={defaults?.email ?? ""}
                placeholder="name@shefaclinic.example"
                required
                invalid={Boolean(errors?.email)}
              />
            </Field>

            <Field label="Phone" htmlFor="phone" error={errors?.phone}>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={defaults?.phone ?? ""}
                placeholder="01712345678"
                invalid={Boolean(errors?.phone)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Role" htmlFor="role" required error={errors?.role}>
              <Select
                id="role"
                name="role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={editing ? "New password" : "Password"}
              htmlFor="password"
              required={!editing}
              error={errors?.password}
              hint="At least 8 characters, with a letter and a number."
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder={editing ? "Leave blank to keep" : "••••••••"}
                required={!editing}
                invalid={Boolean(errors?.password)}
              />
            </Field>
          </div>

          <Checkbox
            name="isActive"
            label="Account is active"
            description="A deactivated account cannot sign in."
            defaultChecked={defaults?.isActive ?? true}
          />

          {/* ---------------- doctor profile ---------------- */}
          {role === "DOCTOR" ? (
            <div className="space-y-4 rounded-lg border border-line bg-surface-muted/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Clinical profile
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Specialization"
                  htmlFor="specialization"
                  required
                  error={errors?.doctor}
                >
                  <Input
                    id="specialization"
                    name="specialization"
                    defaultValue={defaults?.doctor?.specialization ?? ""}
                    placeholder="General Medicine"
                    required
                  />
                </Field>

                <Field label="Qualifications" htmlFor="qualifications" required>
                  <Input
                    id="qualifications"
                    name="qualifications"
                    defaultValue={defaults?.doctor?.qualifications ?? ""}
                    placeholder="MBBS, FCPS"
                    required
                  />
                </Field>

                <Field label="License number" htmlFor="licenseNumber" required>
                  <Input
                    id="licenseNumber"
                    name="licenseNumber"
                    defaultValue={defaults?.doctor?.licenseNumber ?? ""}
                    placeholder="BMDC-A-12345"
                    required
                  />
                </Field>

                <Field
                  label="Consultation fee"
                  htmlFor="consultationFee"
                  required
                >
                  <Input
                    id="consultationFee"
                    name="consultationFee"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={defaults?.doctor?.consultationFee ?? 800}
                    required
                  />
                </Field>

                <Field label="Room" htmlFor="roomNumber">
                  <Input
                    id="roomNumber"
                    name="roomNumber"
                    defaultValue={defaults?.doctor?.roomNumber ?? ""}
                    placeholder="203"
                  />
                </Field>

                <Field label="Slot length (minutes)" htmlFor="slotMinutes" required>
                  <Input
                    id="slotMinutes"
                    name="slotMinutes"
                    type="number"
                    min={10}
                    max={120}
                    step={5}
                    defaultValue={defaults?.doctor?.slotMinutes ?? 30}
                    required
                  />
                </Field>

                <Field label="Clinic opens" htmlFor="startTime" required>
                  <Input
                    id="startTime"
                    name="startTime"
                    type="time"
                    defaultValue={defaults?.doctor?.startTime ?? "09:00"}
                    required
                  />
                </Field>

                <Field label="Clinic closes" htmlFor="endTime" required>
                  <Input
                    id="endTime"
                    name="endTime"
                    type="time"
                    defaultValue={defaults?.doctor?.endTime ?? "17:00"}
                    required
                  />
                </Field>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-ink-secondary">
                  Working days
                  <span className="ml-0.5 text-[var(--danger)]" aria-hidden>
                    *
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((weekday) => (
                    <ToggleChip
                      key={weekday.value}
                      label={weekday.short}
                      checked={days.includes(weekday.value)}
                      onChange={() => toggleDay(weekday.value)}
                    />
                  ))}
                </div>
                {days.length === 0 ? (
                  <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
                    Select at least one working day.
                  </p>
                ) : null}
              </div>

              <Field label="Short bio" htmlFor="bio">
                <Textarea
                  id="bio"
                  name="bio"
                  rows={2}
                  defaultValue={defaults?.doctor?.bio ?? ""}
                  placeholder="Optional — shown on the doctor profile"
                />
              </Field>

              <Checkbox
                name="isAcceptingPatients"
                label="Accepting bookings"
                description="Turn this off to stop new appointments without deactivating the account."
                defaultChecked={defaults?.doctor?.isAcceptingPatients ?? true}
              />
            </div>
          ) : null}
        </CardBody>

        <CardFooter>
          {editing && onDone ? (
            <Button type="button" variant="secondary" onClick={onDone}>
              Cancel
            </Button>
          ) : null}
          <SubmitButton
            pendingLabel="Saving…"
            disabled={role === "DOCTOR" && days.length === 0}
          >
            {editing ? "Save changes" : "Create account"}
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
