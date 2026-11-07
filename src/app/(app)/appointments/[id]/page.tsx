import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LogIn,
  Pencil,
  Pill,
  ReceiptText,
  Stethoscope,
  XCircle,
} from "lucide-react";

import { requireSession } from "@/lib/auth/session";
import { getAppointment } from "@/lib/services/appointment.service";
import { NotFoundError } from "@/lib/errors";
import { BLOOD_GROUP_META } from "@/lib/constants";
import {
  calculateAge,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFriendlyDateTime,
  formatTime,
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
import { Alert } from "@/components/ui/states";
import { AppointmentStatusActions } from "@/components/appointments/status-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const appointment = await getAppointment(id);
    return { title: `Visit ${appointment.code}` };
  } catch {
    return { title: "Appointment" };
  }
}

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const appointment = await getAppointment(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
  const canBill = session.role === "ADMIN" || session.role === "RECEPTIONIST";
  const canReschedule =
    (session.role === "ADMIN" || session.role === "RECEPTIONIST") &&
    ["SCHEDULED", "CHECKED_IN"].includes(appointment.status);

  const timeline = buildTimeline(appointment);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Appointments", href: "/appointments" },
          { label: appointment.code },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {patientName}
            <AppointmentStatusBadge status={appointment.status} />
          </span>
        }
        description={`${formatFriendlyDateTime(appointment.scheduledAt)} · ${appointment.durationMinutes} minutes with ${appointment.doctor.user.name}`}
        actions={
          <>
            {canReschedule ? (
              <Link
                href={`/appointments/${appointment.id}/reschedule`}
                className={buttonClasses("secondary", "md")}
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Reschedule
              </Link>
            ) : null}
            <AppointmentStatusActions
              appointmentId={appointment.id}
              status={appointment.status}
              doctorId={appointment.doctor.id}
              viewer={{ role: session.role, doctorId: session.doctorId }}
              size="md"
            />
          </>
        }
      />

      {appointment.patient.allergies ? (
        <Alert variant="warning" title="Known allergies" className="mb-4">
          {appointment.patient.allergies}
        </Alert>
      ) : null}

      {appointment.status === "CANCELLED" ? (
        <Alert variant="error" title="This visit was cancelled" className="mb-4">
          {appointment.cancellationReason}
          {appointment.cancelledAt
            ? ` — ${formatDateTime(appointment.cancelledAt)}`
            : ""}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        {/* ---------------- main column ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Visit details"
              icon={<CalendarClock className="h-4 w-4" aria-hidden />}
              action={<AppointmentTypeBadge type={appointment.type} />}
            />
            <CardBody>
              <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                <DataRow label="Booking code" value={appointment.code} />
                <DataRow
                  label="Scheduled"
                  value={formatDateTime(appointment.scheduledAt)}
                />
                <DataRow
                  label="Duration"
                  value={`${appointment.durationMinutes} minutes`}
                />
                <DataRow
                  label="Doctor"
                  value={`${appointment.doctor.user.name} · ${appointment.doctor.specialization}`}
                />
                {appointment.doctor.roomNumber ? (
                  <DataRow
                    label="Room"
                    value={appointment.doctor.roomNumber}
                  />
                ) : null}
                {appointment.createdBy ? (
                  <DataRow
                    label="Booked by"
                    value={`${appointment.createdBy.name} · ${formatDate(appointment.createdAt)}`}
                  />
                ) : null}
              </dl>

              <div className="mt-3 border-t border-line pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Reason for visit
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink">
                  {appointment.reason}
                </p>
              </div>

              {appointment.notes ? (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Front-desk notes
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
                    {appointment.notes}
                  </p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {/* ---------------- consultation ---------------- */}
          <Card>
            <CardHeader
              title="Consultation"
              description={
                appointment.consultation
                  ? "Clinical record for this visit"
                  : "Recorded by the attending doctor once the patient is checked in"
              }
              icon={<Stethoscope className="h-4 w-4" aria-hidden />}
              action={
                appointment.consultation ? (
                  <Link
                    href={`/consultations/${appointment.consultation.id}`}
                    className={buttonClasses("secondary", "sm")}
                  >
                    Open record
                  </Link>
                ) : null
              }
            />
            <CardBody>
              {appointment.consultation ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                      Diagnosis
                    </p>
                    <p className="mt-1 text-[15px] font-semibold text-ink">
                      {appointment.consultation.diagnosis}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                      Symptoms
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
                      {appointment.consultation.symptoms}
                    </p>
                  </div>

                  {appointment.consultation.prescriptions.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                        Prescription
                      </p>
                      <ul className="space-y-1.5">
                        {appointment.consultation.prescriptions.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-start gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm"
                          >
                            <Pill
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted"
                              aria-hidden
                            />
                            <span>
                              <span className="font-medium text-ink">
                                {item.medicineName}
                              </span>{" "}
                              <span className="text-ink-secondary">
                                {item.dosage} · {item.frequency} ·{" "}
                                {item.durationDays} day
                                {item.durationDays === 1 ? "" : "s"}
                              </span>
                              {item.instructions ? (
                                <span className="block text-xs text-ink-muted">
                                  {item.instructions}
                                </span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {appointment.consultation.followUpDate ? (
                    <Alert variant="info">
                      Follow-up requested on{" "}
                      {formatDate(appointment.consultation.followUpDate)}.
                    </Alert>
                  ) : null}
                </div>
              ) : appointment.status === "CANCELLED" ||
                appointment.status === "NO_SHOW" ? (
                <p className="py-4 text-center text-sm text-ink-muted">
                  No consultation — the visit did not take place.
                </p>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-sm text-ink-muted">
                    {appointment.status === "SCHEDULED"
                      ? "Check the patient in at the front desk, then the doctor can start the consultation."
                      : "Waiting for the doctor to record the consultation."}
                  </p>
                  {session.role === "DOCTOR" &&
                  session.doctorId === appointment.doctor.id &&
                  appointment.status === "IN_CONSULTATION" ? (
                    <Link
                      href={`/appointments/${appointment.id}/consult`}
                      className={buttonClasses("primary", "md", "mt-4")}
                    >
                      <Stethoscope className="h-4 w-4" aria-hidden />
                      Open consultation form
                    </Link>
                  ) : null}
                </div>
              )}
            </CardBody>
          </Card>

          {/* ---------------- billing ---------------- */}
          {appointment.consultation ? (
            <Card>
              <CardHeader
                title="Billing"
                icon={<ReceiptText className="h-4 w-4" aria-hidden />}
              />
              <CardBody>
                {appointment.consultation.invoice ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="tabular text-sm font-semibold text-ink">
                        {appointment.consultation.invoice.number}
                      </p>
                      <p className="tabular mt-0.5 text-sm text-ink-secondary">
                        {formatCurrency(
                          appointment.consultation.invoice.totalAmount,
                        )}{" "}
                        total ·{" "}
                        {formatCurrency(
                          appointment.consultation.invoice.paidAmount,
                        )}{" "}
                        paid
                      </p>
                      <div className="mt-1.5">
                        <InvoiceStatusBadge
                          status={appointment.consultation.invoice.status}
                        />
                      </div>
                    </div>
                    <Link
                      href={`/invoices/${appointment.consultation.invoice.id}`}
                      className={buttonClasses("secondary", "md")}
                    >
                      Open invoice
                    </Link>
                  </div>
                ) : canBill ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-ink-secondary">
                      This visit has not been billed yet.
                    </p>
                    <Link
                      href={`/invoices/new?consultationId=${appointment.consultation.id}`}
                      className={buttonClasses("primary", "md")}
                    >
                      <ReceiptText className="h-4 w-4" aria-hidden />
                      Create invoice
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted">
                    Not billed yet. The front desk raises the invoice.
                  </p>
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* ---------------- sidebar ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Patient" />
            <CardBody>
              <Link
                href={`/patients/${appointment.patient.id}`}
                className="flex items-center gap-3"
              >
                <Avatar name={patientName} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink hover:text-brand-ink hover:underline">
                    {patientName}
                  </p>
                  <p className="tabular text-sm text-ink-muted">
                    {appointment.patient.mrn}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <GenderBadge gender={appointment.patient.gender} />
                    {appointment.patient.bloodGroup !== "UNKNOWN" ? (
                      <Badge tone="danger">
                        {BLOOD_GROUP_META[appointment.patient.bloodGroup]}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </Link>

              <dl className="mt-4 divide-y divide-[var(--border)]">
                <DataRow
                  label="Age"
                  value={`${calculateAge(appointment.patient.dateOfBirth)} years`}
                />
                <DataRow label="Mobile" value={appointment.patient.phone} />
                {appointment.patient.chronicConditions ? (
                  <DataRow
                    label="Chronic conditions"
                    value={appointment.patient.chronicConditions}
                  />
                ) : null}
              </dl>

              <Link
                href={`/patients/${appointment.patient.id}`}
                className={buttonClasses("secondary", "md", "mt-4 w-full")}
              >
                <ClipboardList className="h-4 w-4" aria-hidden />
                Full visit history
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Progress"
              icon={<Clock3 className="h-4 w-4" aria-hidden />}
            />
            <CardBody>
              <ol className="space-y-3">
                {timeline.map((step) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.label} className="flex items-start gap-3">
                      <span
                        className={
                          step.done
                            ? "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink"
                            : "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted"
                        }
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span
                          className={
                            step.done
                              ? "block text-sm font-medium text-ink"
                              : "block text-sm text-ink-muted"
                          }
                        >
                          {step.label}
                        </span>
                        <span className="block text-xs text-ink-muted">
                          {step.at ? formatTime(step.at) : "—"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function buildTimeline(appointment: {
  createdAt: Date;
  checkedInAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  status: string;
}) {
  if (appointment.status === "CANCELLED") {
    return [
      { label: "Booked", at: appointment.createdAt, done: true, icon: CalendarClock },
      { label: "Cancelled", at: appointment.cancelledAt, done: true, icon: XCircle },
    ];
  }

  return [
    { label: "Booked", at: appointment.createdAt, done: true, icon: CalendarClock },
    {
      label: "Checked in",
      at: appointment.checkedInAt,
      done: Boolean(appointment.checkedInAt),
      icon: LogIn,
    },
    {
      label: "Consultation started",
      at: appointment.startedAt,
      done: Boolean(appointment.startedAt),
      icon: Stethoscope,
    },
    {
      label: "Visit completed",
      at: appointment.completedAt,
      done: Boolean(appointment.completedAt),
      icon: CheckCircle2,
    },
  ];
}
