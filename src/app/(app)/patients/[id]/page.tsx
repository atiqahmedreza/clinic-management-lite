import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CalendarPlus,
  ClipboardList,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Pill,
  ReceiptText,
  Stethoscope,
} from "lucide-react";

import { requireSession } from "@/lib/auth/session";
import { getPatientProfile } from "@/lib/services/patient.service";
import { NotFoundError } from "@/lib/errors";
import { BLOOD_GROUP_META } from "@/lib/constants";
import {
  calculateAge,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFriendlyDateTime,
} from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, DataRow } from "@/components/ui/card";
import {
  AppointmentStatusBadge,
  AppointmentTypeBadge,
  Avatar,
  Badge,
  GenderBadge,
  InvoiceStatusBadge,
} from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/states";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const patient = await getPatientProfile(id);
    return { title: `${patient.firstName} ${patient.lastName}` };
  } catch {
    return { title: "Patient" };
  }
}

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const patient = await getPatientProfile(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const name = `${patient.firstName} ${patient.lastName}`;
  const canBill = session.role === "ADMIN" || session.role === "RECEPTIONIST";

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Patients", href: "/patients" }, { label: name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {name}
            {!patient.isActive ? <Badge tone="neutral">Archived</Badge> : null}
          </span>
        }
        description={`${patient.mrn} · ${calculateAge(patient.dateOfBirth)} years old · registered ${formatDate(patient.createdAt)}`}
        actions={
          <>
            <Link
              href={`/patients/${patient.id}/edit`}
              className={buttonClasses("secondary", "md")}
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Edit
            </Link>
            {patient.isActive ? (
              <Link
                href={`/appointments/new?patientId=${patient.id}`}
                className={buttonClasses("primary", "md")}
              >
                <CalendarPlus className="h-4 w-4" aria-hidden />
                Book visit
              </Link>
            ) : null}
          </>
        }
      />

      {patient.allergies ? (
        <Alert variant="warning" title="Known allergies" className="mb-4">
          {patient.allergies}
        </Alert>
      ) : null}

      {!patient.isActive ? (
        <Alert variant="info" className="mb-4">
          This record is archived. Reactivate it from the edit screen before
          booking a new visit.
        </Alert>
      ) : null}

      {/* ---------------- summary ---------------- */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <SummaryTile
          label="Visits"
          value={patient.summary.totalVisits}
          hint={
            patient.summary.lastVisitAt
              ? `Last ${formatDate(patient.summary.lastVisitAt)}`
              : "No consultations yet"
          }
        />
        <SummaryTile
          label="Appointments"
          value={patient.summary.totalAppointments}
          hint="Booked all time"
        />
        <SummaryTile
          label="Billed"
          value={formatCurrency(patient.summary.totalBilled)}
          hint={`${formatCurrency(patient.summary.totalPaid)} paid`}
        />
        <SummaryTile
          label="Outstanding"
          value={formatCurrency(patient.summary.outstanding)}
          hint={patient.summary.outstanding > 0 ? "Due at the desk" : "Settled"}
          emphasis={patient.summary.outstanding > 0}
        />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* ---------------- profile card ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardBody>
              <div className="flex items-center gap-3">
                <Avatar name={name} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink">
                    {name}
                  </p>
                  <p className="tabular text-sm text-ink-muted">{patient.mrn}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <GenderBadge gender={patient.gender} />
                    {patient.bloodGroup !== "UNKNOWN" ? (
                      <Badge tone="danger">
                        {BLOOD_GROUP_META[patient.bloodGroup]}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              <dl className="mt-5 divide-y divide-[var(--border)]">
                <DataRow
                  label="Mobile"
                  value={
                    <span className="tabular flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
                      {patient.phone}
                    </span>
                  }
                />
                {patient.email ? (
                  <DataRow
                    label="Email"
                    value={
                      <span className="flex items-center gap-1.5 break-all">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
                        {patient.email}
                      </span>
                    }
                  />
                ) : null}
                <DataRow
                  label="Date of birth"
                  value={`${formatDate(patient.dateOfBirth)} (${calculateAge(patient.dateOfBirth)} yrs)`}
                />
                {patient.address || patient.city ? (
                  <DataRow
                    label="Address"
                    value={
                      <span className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
                        <span>
                          {[patient.address, patient.city]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </span>
                    }
                  />
                ) : null}
                {patient.chronicConditions ? (
                  <DataRow
                    label="Chronic conditions"
                    value={patient.chronicConditions}
                  />
                ) : null}
                {patient.emergencyContactName ? (
                  <DataRow
                    label="Emergency contact"
                    value={
                      <>
                        {patient.emergencyContactName}
                        {patient.emergencyContactPhone ? (
                          <span className="tabular block text-ink-muted">
                            {patient.emergencyContactPhone}
                          </span>
                        ) : null}
                      </>
                    }
                  />
                ) : null}
                {patient.createdBy ? (
                  <DataRow
                    label="Registered by"
                    value={patient.createdBy.name}
                  />
                ) : null}
              </dl>
            </CardBody>
          </Card>

          {/* ---------------- invoices ---------------- */}
          {canBill ? (
            <Card>
              <CardHeader
                title="Invoices"
                icon={<ReceiptText className="h-4 w-4" aria-hidden />}
              />
              {patient.invoices.length === 0 ? (
                <EmptyState
                  title="No invoices yet"
                  description="Invoices appear once a consultation is billed."
                  className="py-8"
                />
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {patient.invoices.map((invoice) => (
                    <li key={invoice.id}>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-muted"
                      >
                        <div className="min-w-0">
                          <p className="tabular truncate text-sm font-medium text-ink">
                            {invoice.number}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {formatDate(invoice.issuedAt)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tabular text-sm font-semibold text-ink">
                            {formatCurrency(invoice.totalAmount)}
                          </p>
                          <InvoiceStatusBadge status={invoice.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>

        {/* ---------------- history ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Visit history"
              description="Every recorded consultation, newest first"
              icon={<Stethoscope className="h-4 w-4" aria-hidden />}
            />
            {patient.consultations.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-5 w-5" aria-hidden />}
                title="No consultations recorded"
                description="Once the doctor completes a visit, the clinical record shows up here."
                action={
                  patient.isActive ? (
                    <Link
                      href={`/appointments/new?patientId=${patient.id}`}
                      className={buttonClasses("primary", "md")}
                    >
                      Book a visit
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <ol className="divide-y divide-[var(--border)]">
                {patient.consultations.map((consultation) => (
                  <li key={consultation.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">
                          {consultation.diagnosis}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {formatDateTime(consultation.createdAt)} ·{" "}
                          {consultation.doctor.user.name} (
                          {consultation.doctor.specialization})
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <AppointmentTypeBadge
                          type={consultation.appointment.type}
                        />
                        <Link
                          href={`/consultations/${consultation.id}`}
                          className={buttonClasses("ghost", "sm")}
                        >
                          Open
                        </Link>
                      </div>
                    </div>

                    <p className="mt-2 line-clamp-2 text-sm text-ink-secondary">
                      <span className="font-medium text-ink-muted">
                        Symptoms:{" "}
                      </span>
                      {consultation.symptoms}
                    </p>

                    {consultation.prescriptions.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <Pill className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
                        {consultation.prescriptions.slice(0, 4).map((item) => (
                          <Badge key={item.id} tone="neutral">
                            {item.medicineName} {item.dosage}
                          </Badge>
                        ))}
                        {consultation.prescriptions.length > 4 ? (
                          <span className="text-xs text-ink-muted">
                            +{consultation.prescriptions.length - 4} more
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                      {consultation.followUpDate ? (
                        <span className="inline-flex items-center gap-1 text-ink-secondary">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                          Follow-up {formatDate(consultation.followUpDate)}
                        </span>
                      ) : null}
                      {consultation.invoice ? (
                        <Link
                          href={`/invoices/${consultation.invoice.id}`}
                          className="tabular inline-flex items-center gap-1 text-brand-ink hover:underline"
                        >
                          <ReceiptText className="h-3.5 w-3.5" aria-hidden />
                          {consultation.invoice.number} ·{" "}
                          {formatCurrency(consultation.invoice.totalAmount)}
                        </Link>
                      ) : canBill ? (
                        <Link
                          href={`/invoices/new?consultationId=${consultation.id}`}
                          className="inline-flex items-center gap-1 font-medium text-brand-ink hover:underline"
                        >
                          <ReceiptText className="h-3.5 w-3.5" aria-hidden />
                          Not billed — create invoice
                        </Link>
                      ) : (
                        <span className="text-ink-muted">Not billed yet</span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {/* ---------------- appointments ---------------- */}
          <Card>
            <CardHeader
              title="All appointments"
              description="Including cancellations and no-shows"
            />
            {patient.appointments.length === 0 ? (
              <EmptyState
                title="No appointments booked"
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {patient.appointments.map((appointment) => (
                  <li key={appointment.id}>
                    <Link
                      href={`/appointments/${appointment.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 transition-colors hover:bg-surface-muted"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          {formatFriendlyDateTime(appointment.scheduledAt)}
                        </p>
                        <p className="tabular truncate text-xs text-ink-muted">
                          {appointment.code} · {appointment.doctor.user.name}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <AppointmentStatusBadge status={appointment.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p
        className={`tabular mt-1.5 text-lg font-semibold ${
          emphasis ? "text-[var(--danger)]" : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
