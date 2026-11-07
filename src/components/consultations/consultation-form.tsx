"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, HeartPulse, Pill, Stethoscope } from "lucide-react";

import {
  saveConsultationAction,
  type ConsultationActionState,
} from "@/actions/consultation.actions";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  PrescriptionEditor,
  type PrescriptionRow,
} from "@/components/consultations/prescription-editor";

export type ConsultationDefaults = {
  temperatureC?: number | null;
  pulseBpm?: number | null;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  respiratoryBpm?: number | null;
  spo2?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  symptoms?: string;
  examination?: string | null;
  diagnosis?: string;
  treatmentPlan?: string | null;
  advice?: string | null;
  followUpDate?: string;
  prescriptions?: {
    medicineName: string;
    dosage: string;
    frequency: string;
    durationDays: number;
    instructions?: string | null;
  }[];
};

const VITALS: {
  name: keyof ConsultationDefaults;
  label: string;
  unit: string;
  step?: string;
  placeholder: string;
}[] = [
  { name: "temperatureC", label: "Temperature", unit: "°C", step: "0.1", placeholder: "37.0" },
  { name: "pulseBpm", label: "Pulse", unit: "bpm", placeholder: "78" },
  { name: "systolicBp", label: "Systolic BP", unit: "mmHg", placeholder: "120" },
  { name: "diastolicBp", label: "Diastolic BP", unit: "mmHg", placeholder: "80" },
  { name: "respiratoryBpm", label: "Respiratory rate", unit: "/min", placeholder: "16" },
  { name: "spo2", label: "SpO₂", unit: "%", placeholder: "98" },
  { name: "weightKg", label: "Weight", unit: "kg", step: "0.1", placeholder: "68.5" },
  { name: "heightCm", label: "Height", unit: "cm", step: "0.1", placeholder: "170" },
];

export function ConsultationForm({
  appointmentId,
  patientId,
  defaults = {},
}: {
  appointmentId: string;
  patientId: string;
  defaults?: ConsultationDefaults;
}) {
  const router = useRouter();
  const toast = useToast();

  const [state, formAction] = useActionState<ConsultationActionState, FormData>(
    saveConsultationAction,
    null,
  );

  const [prescriptions, setPrescriptions] = React.useState<PrescriptionRow[]>(
    () =>
      (defaults.prescriptions ?? []).map((item) => ({
        key: Math.random().toString(36).slice(2),
        medicineName: item.medicineName,
        dosage: item.dosage,
        frequency: item.frequency,
        durationDays: item.durationDays,
        instructions: item.instructions ?? "",
      })),
  );

  React.useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? "Consultation saved.");
    router.push(`/consultations/${state.data.id}`);
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const topError = state && !state.ok ? state.error : undefined;

  const vitalValue = (name: keyof ConsultationDefaults) => {
    const value = defaults[name];
    return typeof value === "number" ? String(value) : "";
  };

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="appointmentId" value={appointmentId} />

      {topError ? (
        <Alert variant="error" title="Could not save the consultation">
          {topError}
        </Alert>
      ) : null}

      {/* ---------------- vitals ---------------- */}
      <Card>
        <CardHeader
          title="Vitals"
          description="Optional, but every value entered is range-checked before it reaches the record."
          icon={<HeartPulse className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {VITALS.map((vital) => (
            <Field
              key={vital.name}
              label={`${vital.label} (${vital.unit})`}
              htmlFor={vital.name}
              error={errors?.[vital.name]}
            >
              <Input
                id={vital.name}
                name={vital.name}
                type="number"
                inputMode="decimal"
                step={vital.step ?? "1"}
                defaultValue={vitalValue(vital.name)}
                placeholder={vital.placeholder}
                invalid={Boolean(errors?.[vital.name])}
              />
            </Field>
          ))}
        </CardBody>
      </Card>

      {/* ---------------- clinical notes ---------------- */}
      <Card>
        <CardHeader
          title="Clinical notes"
          description="Symptoms and a diagnosis are required to close the visit."
          icon={<Stethoscope className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="space-y-4">
          <Field
            label="Presenting symptoms"
            htmlFor="symptoms"
            required
            error={errors?.symptoms}
          >
            <Textarea
              id="symptoms"
              name="symptoms"
              rows={3}
              defaultValue={defaults.symptoms ?? ""}
              placeholder="What the patient reports, duration, severity…"
              required
              invalid={Boolean(errors?.symptoms)}
            />
          </Field>

          <Field
            label="Examination findings"
            htmlFor="examination"
            error={errors?.examination}
          >
            <Textarea
              id="examination"
              name="examination"
              rows={3}
              defaultValue={defaults.examination ?? ""}
              placeholder="On examination…"
            />
          </Field>

          <Field
            label="Diagnosis"
            htmlFor="diagnosis"
            required
            error={errors?.diagnosis}
            hint="This is what shows on the patient's visit history."
          >
            <Textarea
              id="diagnosis"
              name="diagnosis"
              rows={2}
              defaultValue={defaults.diagnosis ?? ""}
              placeholder="Acute pharyngitis"
              required
              invalid={Boolean(errors?.diagnosis)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Treatment plan"
              htmlFor="treatmentPlan"
              error={errors?.treatmentPlan}
            >
              <Textarea
                id="treatmentPlan"
                name="treatmentPlan"
                rows={3}
                defaultValue={defaults.treatmentPlan ?? ""}
                placeholder="Rest, fluids, review if fever persists…"
              />
            </Field>

            <Field label="Advice to patient" htmlFor="advice" error={errors?.advice}>
              <Textarea
                id="advice"
                name="advice"
                rows={3}
                defaultValue={defaults.advice ?? ""}
                placeholder="Avoid cold drinks, complete the full course…"
              />
            </Field>
          </div>

          <Field
            label="Follow-up date"
            htmlFor="followUpDate"
            error={errors?.followUpDate}
            hint="Leave empty if no follow-up is needed. Scheduled follow-ups appear on the dashboard."
            className="sm:max-w-xs"
          >
            <Input
              id="followUpDate"
              name="followUpDate"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              defaultValue={defaults.followUpDate ?? ""}
              invalid={Boolean(errors?.followUpDate)}
            />
          </Field>
        </CardBody>
      </Card>

      {/* ---------------- prescription ---------------- */}
      <Card>
        <CardHeader
          title="Prescription"
          description="Printed on the consultation record."
          icon={<Pill className="h-4 w-4" aria-hidden />}
        />
        <CardBody>
          <PrescriptionEditor
            rows={prescriptions}
            onChange={setPrescriptions}
            error={
              Array.isArray(errors?.prescriptions)
                ? errors?.prescriptions[0]
                : undefined
            }
          />
        </CardBody>

        <CardFooter>
          <Link
            href={`/appointments/${appointmentId}`}
            className={buttonClasses("secondary", "md")}
          >
            Back to visit
          </Link>
          <SubmitButton
            pendingLabel="Saving…"
            icon={<Activity className="h-4 w-4" aria-hidden />}
          >
            Save &amp; complete visit
          </SubmitButton>
        </CardFooter>
      </Card>

      <p className="pb-2 text-center text-xs text-ink-muted">
        Saving marks the appointment <strong>completed</strong> and makes the
        visit ready for billing.{" "}
        <Link
          href={`/patients/${patientId}`}
          className="text-brand-ink hover:underline"
        >
          View patient history
        </Link>
      </p>
    </form>
  );
}
