import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Activity,
  CalendarPlus,
  HeartPulse,
  Pill,
  Printer,
  ReceiptText,
  Stethoscope,
} from "lucide-react";

import { requireSession } from "@/lib/auth/session";
import { getConsultation } from "@/lib/services/consultation.service";
import { NotFoundError } from "@/lib/errors";
import { BLOOD_GROUP_META, CLINIC } from "@/lib/constants";
import {
  calculateAge,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, DataRow } from "@/components/ui/card";
import {
  Avatar,
  Badge,
  GenderBadge,
  InvoiceStatusBadge,
} from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/states";
import { PrintButton } from "@/components/billing/print-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const consultation = await getConsultation(id);
    return {
      title: `${consultation.patient.firstName} ${consultation.patient.lastName} — consultation`,
    };
  } catch {
    return { title: "Consultation" };
  }
}

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const consultation = await getConsultation(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const patientName = `${consultation.patient.firstName} ${consultation.patient.lastName}`;
  const canBill = session.role === "ADMIN" || session.role === "RECEPTIONIST";

  const vitals = [
    { label: "Temperature", value: consultation.temperatureC, unit: "°C" },
    { label: "Pulse", value: consultation.pulseBpm, unit: "bpm" },
    {
      label: "Blood pressure",
      value:
        consultation.systolicBp && consultation.diastolicBp
          ? `${consultation.systolicBp}/${consultation.diastolicBp}`
          : null,
      unit: "mmHg",
    },
    { label: "Respiratory rate", value: consultation.respiratoryBpm, unit: "/min" },
    { label: "SpO₂", value: consultation.spo2, unit: "%" },
    { label: "Weight", value: consultation.weightKg, unit: "kg" },
    { label: "Height", value: consultation.heightCm, unit: "cm" },
  ].filter((vital) => vital.value !== null && vital.value !== undefined);

  const bmi =
    consultation.weightKg && consultation.heightCm
      ? (
          consultation.weightKg /
          (consultation.heightCm / 100) ** 2
        ).toFixed(1)
      : null;

  return (
    <>
      <div className="no-print">
        <PageHeader
          breadcrumbs={[
            { label: "Consultations", href: "/consultations" },
            { label: patientName },
          ]}
          title={consultation.diagnosis}
          description={`${patientName} · ${formatDateTime(consultation.createdAt)} · ${consultation.doctor.user.name}`}
          actions={
            <>
              <PrintButton label="Print record" />
              {consultation.invoice ? (
                <Link
                  href={`/invoices/${consultation.invoice.id}`}
                  className={buttonClasses("secondary", "md")}
                >
                  <ReceiptText className="h-4 w-4" aria-hidden />
                  {consultation.invoice.number}
                </Link>
              ) : canBill ? (
                <Link
                  href={`/invoices/new?consultationId=${consultation.id}`}
                  className={buttonClasses("primary", "md")}
                >
                  <ReceiptText className="h-4 w-4" aria-hidden />
                  Create invoice
                </Link>
              ) : null}
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* ---------------- record ---------------- */}
        <div className="print-area space-y-4">
          {/* print-only letterhead */}
          <div className="hidden print:block">
            <p className="text-lg font-semibold">{CLINIC.name}</p>
            <p className="text-sm">
              {CLINIC.addressLine1}, {CLINIC.addressLine2} · {CLINIC.phone}
            </p>
            <hr className="my-3" />
            <p className="text-sm">
              <strong>{patientName}</strong> · {consultation.patient.mrn} ·{" "}
              {calculateAge(consultation.patient.dateOfBirth)} yrs ·{" "}
              {formatDateTime(consultation.createdAt)}
            </p>
            <p className="text-sm">
              Attending: {consultation.doctor.user.name} (
              {consultation.doctor.specialization})
            </p>
            <hr className="my-3" />
          </div>

          {vitals.length > 0 ? (
            <Card>
              <CardHeader
                title="Vitals"
                icon={<HeartPulse className="h-4 w-4" aria-hidden />}
                action={
                  bmi ? (
                    <span className="tabular text-sm text-ink-secondary">
                      BMI {bmi}
                    </span>
                  ) : null
                }
              />
              <CardBody>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {vitals.map((vital) => (
                    <div
                      key={vital.label}
                      className="rounded-lg bg-surface-muted px-3 py-2.5"
                    >
                      <dt className="text-xs text-ink-muted">{vital.label}</dt>
                      <dd className="tabular mt-0.5 text-[15px] font-semibold text-ink">
                        {String(vital.value)}
                        <span className="ml-1 text-xs font-normal text-ink-muted">
                          {vital.unit}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Clinical record"
              icon={<Stethoscope className="h-4 w-4" aria-hidden />}
            />
            <CardBody className="space-y-4">
              <Section title="Presenting symptoms" body={consultation.symptoms} />
              {consultation.examination ? (
                <Section
                  title="Examination findings"
                  body={consultation.examination}
                />
              ) : null}
              <Section
                title="Diagnosis"
                body={consultation.diagnosis}
                emphasis
              />
              {consultation.treatmentPlan ? (
                <Section title="Treatment plan" body={consultation.treatmentPlan} />
              ) : null}
              {consultation.advice ? (
                <Section title="Advice to patient" body={consultation.advice} />
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Prescription"
              icon={<Pill className="h-4 w-4" aria-hidden />}
              action={
                <span className="text-sm text-ink-muted">
                  {consultation.prescriptions.length} item
                  {consultation.prescriptions.length === 1 ? "" : "s"}
                </span>
              }
            />
            <CardBody>
              {consultation.prescriptions.length === 0 ? (
                <p className="py-3 text-center text-sm text-ink-muted">
                  No medicines were prescribed at this visit.
                </p>
              ) : (
                <ol className="divide-y divide-[var(--border)]">
                  {consultation.prescriptions.map((item, index) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <span className="tabular mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-ink-secondary">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">
                          {item.medicineName}{" "}
                          <span className="font-normal text-ink-secondary">
                            {item.dosage}
                          </span>
                        </p>
                        <p className="mt-0.5 text-sm text-ink-secondary">
                          {item.frequency} · {item.durationDays} day
                          {item.durationDays === 1 ? "" : "s"}
                        </p>
                        {item.instructions ? (
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {item.instructions}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          {consultation.followUpDate ? (
            <Alert variant="info" title="Follow-up">
              Review scheduled for {formatDate(consultation.followUpDate)}.{" "}
              <Link
                href={`/appointments/new?patientId=${consultation.patient.id}&doctorId=${consultation.doctorId}`}
                className="font-medium underline no-print"
              >
                Book the follow-up
              </Link>
            </Alert>
          ) : null}

          <div className="hidden print:block pt-10">
            <p className="text-sm">
              ______________________________
              <br />
              {consultation.doctor.user.name}
              <br />
              {consultation.doctor.qualifications}
              <br />
              Reg. {consultation.doctor.licenseNumber}
            </p>
          </div>
        </div>

        {/* ---------------- sidebar ---------------- */}
        <aside className="no-print space-y-4">
          <Card>
            <CardHeader title="Patient" />
            <CardBody>
              <Link
                href={`/patients/${consultation.patient.id}`}
                className="flex items-center gap-3"
              >
                <Avatar name={patientName} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink hover:text-brand-ink hover:underline">
                    {patientName}
                  </p>
                  <p className="tabular text-sm text-ink-muted">
                    {consultation.patient.mrn}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <GenderBadge gender={consultation.patient.gender} />
                    {consultation.patient.bloodGroup !== "UNKNOWN" ? (
                      <Badge tone="danger">
                        {BLOOD_GROUP_META[consultation.patient.bloodGroup]}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </Link>

              <dl className="mt-4 divide-y divide-[var(--border)]">
                <DataRow
                  label="Age"
                  value={`${calculateAge(consultation.patient.dateOfBirth)} years`}
                />
                <DataRow label="Mobile" value={consultation.patient.phone} />
                {consultation.patient.allergies ? (
                  <DataRow
                    label="Allergies"
                    value={consultation.patient.allergies}
                  />
                ) : null}
              </dl>

              <div className="mt-4 grid gap-2">
                <Link
                  href={`/patients/${consultation.patient.id}`}
                  className={buttonClasses("secondary", "md", "w-full")}
                >
                  Visit history
                </Link>
                <Link
                  href={`/appointments/new?patientId=${consultation.patient.id}`}
                  className={buttonClasses("ghost", "md", "w-full")}
                >
                  <CalendarPlus className="h-4 w-4" aria-hidden />
                  Book next visit
                </Link>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Visit"
              icon={<Activity className="h-4 w-4" aria-hidden />}
            />
            <CardBody>
              <dl className="divide-y divide-[var(--border)]">
                <DataRow
                  label="Booking code"
                  value={
                    <Link
                      href={`/appointments/${consultation.appointmentId}`}
                      className="tabular text-brand-ink hover:underline"
                    >
                      {consultation.appointment.code}
                    </Link>
                  }
                />
                <DataRow
                  label="Scheduled"
                  value={formatDateTime(consultation.appointment.scheduledAt)}
                />
                <DataRow
                  label="Attending doctor"
                  value={`${consultation.doctor.user.name} · ${consultation.doctor.specialization}`}
                />
                <DataRow
                  label="Recorded"
                  value={formatDateTime(consultation.createdAt)}
                />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Billing"
              icon={<ReceiptText className="h-4 w-4" aria-hidden />}
            />
            <CardBody>
              {consultation.invoice ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="tabular text-sm font-semibold text-ink">
                      {consultation.invoice.number}
                    </span>
                    <InvoiceStatusBadge status={consultation.invoice.status} />
                  </div>
                  <p className="tabular mt-1 text-sm text-ink-secondary">
                    {formatCurrency(consultation.invoice.totalAmount)} total ·{" "}
                    {formatCurrency(consultation.invoice.paidAmount)} paid
                  </p>
                  <Link
                    href={`/invoices/${consultation.invoice.id}`}
                    className={buttonClasses("secondary", "md", "mt-3 w-full")}
                  >
                    Open invoice
                  </Link>
                </>
              ) : canBill ? (
                <>
                  <p className="text-sm text-ink-secondary">
                    This visit has not been billed yet.
                  </p>
                  <Link
                    href={`/invoices/new?consultationId=${consultation.id}`}
                    className={buttonClasses("primary", "md", "mt-3 w-full")}
                  >
                    Create invoice
                  </Link>
                </>
              ) : (
                <p className="text-sm text-ink-muted">
                  Not billed yet — the front desk raises the invoice.
                </p>
              )}
            </CardBody>
          </Card>

          <p className="flex items-center justify-center gap-1.5 text-xs text-ink-muted">
            <Printer className="h-3.5 w-3.5" aria-hidden />
            Printing gives a clean A4 prescription sheet.
          </p>
        </aside>
      </div>
    </>
  );
}

function Section({
  title,
  body,
  emphasis = false,
}: {
  title: string;
  body: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {title}
      </p>
      <p
        className={
          emphasis
            ? "mt-1 whitespace-pre-line text-[15px] font-semibold leading-relaxed text-ink"
            : "mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-secondary"
        }
      >
        {body}
      </p>
    </div>
  );
}
