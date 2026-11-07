"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  createPatientAction,
  updatePatientAction,
  type PatientActionState,
} from "@/actions/patient.actions";
import {
  BLOOD_GROUP_OPTIONS,
  GENDER_OPTIONS,
} from "@/lib/constants";
import { toDateInputValue } from "@/lib/utils";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

export type PatientFormValues = {
  id?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date | string | null;
  gender?: string;
  phone?: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  bloodGroup?: string;
  allergies?: string | null;
  chronicConditions?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  isActive?: boolean;
};

export function PatientForm({
  mode,
  defaults = {},
  /** Where to go after a successful save. `profile` uses the new patient id. */
  onSuccess = "profile",
  cancelHref = "/patients",
}: {
  mode: "create" | "edit";
  defaults?: PatientFormValues;
  onSuccess?: "profile" | "book";
  cancelHref?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const action = mode === "create" ? createPatientAction : updatePatientAction;
  const [state, formAction] = useActionState<PatientActionState, FormData>(
    action,
    null,
  );

  React.useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? "Saved.");
    router.push(
      onSuccess === "book"
        ? `/appointments/new?patientId=${state.data.id}`
        : `/patients/${state.data.id}`,
    );
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const topError = state && !state.ok ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      {topError ? (
        <Alert variant="error" title="Could not save this patient">
          {topError}
        </Alert>
      ) : null}

      {/* ---------------- identity ---------------- */}
      <Card>
        <CardHeader
          title="Patient details"
          description="The name, date of birth and phone number identify the record."
        />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            htmlFor="firstName"
            required
            error={errors?.firstName}
          >
            <Input
              id="firstName"
              name="firstName"
              defaultValue={defaults.firstName ?? ""}
              placeholder="Ayesha"
              autoComplete="given-name"
              required
              invalid={Boolean(errors?.firstName)}
            />
          </Field>

          <Field
            label="Last name"
            htmlFor="lastName"
            required
            error={errors?.lastName}
          >
            <Input
              id="lastName"
              name="lastName"
              defaultValue={defaults.lastName ?? ""}
              placeholder="Siddiqui"
              autoComplete="family-name"
              required
              invalid={Boolean(errors?.lastName)}
            />
          </Field>

          <Field
            label="Date of birth"
            htmlFor="dateOfBirth"
            required
            error={errors?.dateOfBirth}
          >
            <Input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              defaultValue={toDateInputValue(defaults.dateOfBirth)}
              required
              invalid={Boolean(errors?.dateOfBirth)}
            />
          </Field>

          <Field label="Gender" htmlFor="gender" required error={errors?.gender}>
            <Select
              id="gender"
              name="gender"
              defaultValue={defaults.gender ?? ""}
              required
              invalid={Boolean(errors?.gender)}
            >
              <option value="" disabled>
                Select…
              </option>
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Mobile number"
            htmlFor="phone"
            required
            error={errors?.phone}
            hint="Used to find the patient at the front desk. Must be unique."
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={defaults.phone ?? ""}
              placeholder="01712345678"
              autoComplete="tel"
              required
              invalid={Boolean(errors?.phone)}
            />
          </Field>

          <Field label="Email" htmlFor="email" error={errors?.email}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={defaults.email ?? ""}
              placeholder="optional"
              autoComplete="email"
              invalid={Boolean(errors?.email)}
            />
          </Field>

          <Field label="Blood group" htmlFor="bloodGroup" error={errors?.bloodGroup}>
            <Select
              id="bloodGroup"
              name="bloodGroup"
              defaultValue={defaults.bloodGroup ?? "UNKNOWN"}
            >
              {BLOOD_GROUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="City" htmlFor="city" error={errors?.city}>
            <Input
              id="city"
              name="city"
              defaultValue={defaults.city ?? ""}
              placeholder="Dhaka"
              autoComplete="address-level2"
            />
          </Field>

          <Field
            label="Address"
            htmlFor="address"
            error={errors?.address}
            className="sm:col-span-2"
          >
            <Textarea
              id="address"
              name="address"
              rows={2}
              defaultValue={defaults.address ?? ""}
              placeholder="House, road, area"
            />
          </Field>
        </CardBody>
      </Card>

      {/* ---------------- clinical ---------------- */}
      <Card>
        <CardHeader
          title="Clinical notes"
          description="Shown to the doctor at the top of every consultation."
        />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Known allergies" htmlFor="allergies" error={errors?.allergies}>
            <Textarea
              id="allergies"
              name="allergies"
              rows={2}
              defaultValue={defaults.allergies ?? ""}
              placeholder="Penicillin, peanuts…"
            />
          </Field>

          <Field
            label="Chronic conditions"
            htmlFor="chronicConditions"
            error={errors?.chronicConditions}
          >
            <Textarea
              id="chronicConditions"
              name="chronicConditions"
              rows={2}
              defaultValue={defaults.chronicConditions ?? ""}
              placeholder="Type 2 diabetes, hypertension…"
            />
          </Field>
        </CardBody>
      </Card>

      {/* ---------------- emergency contact ---------------- */}
      <Card>
        <CardHeader title="Emergency contact" description="Optional, but useful." />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Contact name"
            htmlFor="emergencyContactName"
            error={errors?.emergencyContactName}
          >
            <Input
              id="emergencyContactName"
              name="emergencyContactName"
              defaultValue={defaults.emergencyContactName ?? ""}
              placeholder="Relative or guardian"
            />
          </Field>

          <Field
            label="Contact number"
            htmlFor="emergencyContactPhone"
            error={errors?.emergencyContactPhone}
          >
            <Input
              id="emergencyContactPhone"
              name="emergencyContactPhone"
              type="tel"
              inputMode="tel"
              defaultValue={defaults.emergencyContactPhone ?? ""}
              placeholder="01812345678"
              invalid={Boolean(errors?.emergencyContactPhone)}
            />
          </Field>

          {mode === "edit" ? (
            <div className="sm:col-span-2">
              <Checkbox
                name="isActive"
                label="Active patient"
                description="Archived patients stay in the history but cannot be booked."
                defaultChecked={defaults.isActive ?? true}
              />
            </div>
          ) : null}
        </CardBody>

        <CardFooter>
          <Link href={cancelHref} className={buttonClasses("secondary", "md")}>
            Cancel
          </Link>
          <SubmitButton pendingLabel="Saving…">
            {mode === "create" ? "Register patient" : "Save changes"}
          </SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
