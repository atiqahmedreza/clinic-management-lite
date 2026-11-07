import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClipboardList, History, ShieldAlert } from "lucide-react";

import { requireSession } from "@/lib/auth/session";
import { getAppointment } from "@/lib/services/appointment.service";
import { getPatientHistoryForConsultation } from "@/lib/services/consultation.service";
import { NotFoundError } from "@/lib/errors";
import { BLOOD_GROUP_META } from "@/lib/constants";
import {
  calculateAge,
  formatDate,
  formatFriendlyDateTime,
  toDateInputValue,
} from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, Badge, GenderBadge } from "@/components/ui/badge";
import { Alert, EmptyState } from "@/components/ui/states";
import { buttonClasses } from "@/components/ui/button";
import { ConsultationForm } from "@/components/consultations/consultation-form";

export const metadata: Metadata = { title: "Consultation" };
export const dynamic = "force-dynamic";

export default async function ConsultPage({
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

  // Only the attending doctor (or an administrator) may open the record.
  const isAttending =
    session.role === "ADMIN" ||
    (session.role === "DOCTOR" && session.doctorId === appointment.doctor.id);

  if (!isAttending) {
    return (
      <Card>
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
          title="This consultation is not yours to record"
          description={`Visit ${appointment.code} is assigned to ${appointment.doctor.user.name}. Only the attending doctor can write the clinical record.`}
          action={
            <Link
              href={`/appointments/${appointment.id}`}
              className={buttonClasses("secondary", "md")}
            >
              Back to the visit
            </Link>
          }
        />
      </Card>
    );
  }

  // A completed visit already has its record - send the doctor to it.
  if (appointment.status === "COMPLETED" && appointment.consultation) {
    redirect(`/consultations/${appointment.consultation.id}`);
  }

  if (!["CHECKED_IN", "IN_CONSULTATION"].includes(appointment.status)) {
    return (
      <Card>
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" aria-hidden />}
          title="The patient is not checked in yet"
          description="The front desk checks the patient in on arrival. Once that happens, this form opens."
          action={
            <Link
              href={`/appointments/${appointment.id}`}
              className={buttonClasses("secondary", "md")}
            >
              Back to the visit
            </Link>
          }
        />
      </Card>
    );
  }

  const history = await getPatientHistoryForConsultation(
    appointment.patient.id,
    appointment.consultation?.id,
  );

  const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Appointments", href: "/appointments" },
          { label: appointment.code, href: `/appointments/${appointment.id}` },
          { label: "Consultation" },
        ]}
        title={`Consultation — ${patientName}`}
        description={`${formatFriendlyDateTime(appointment.scheduledAt)} · ${appointment.reason}`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 lg:order-1">
          <ConsultationForm
            appointmentId={appointment.id}
            patientId={appointment.patient.id}
            defaults={
              appointment.consultation
                ? {
                    temperatureC: appointment.consultation.temperatureC,
                    pulseBpm: appointment.consultation.pulseBpm,
                    systolicBp: appointment.consultation.systolicBp,
                    diastolicBp: appointment.consultation.diastolicBp,
                    respiratoryBpm: appointment.consultation.respiratoryBpm,
                    spo2: appointment.consultation.spo2,
                    weightKg: appointment.consultation.weightKg,
                    heightCm: appointment.consultation.heightCm,
                    symptoms: appointment.consultation.symptoms,
                    examination: appointment.consultation.examination,
                    diagnosis: appointment.consultation.diagnosis,
                    treatmentPlan: appointment.consultation.treatmentPlan,
                    advice: appointment.consultation.advice,
                    followUpDate: toDateInputValue(
                      appointment.consultation.followUpDate,
                    ),
                    prescriptions: appointment.consultation.prescriptions,
                  }
                : { symptoms: appointment.reason }
            }
          />
        </div>

        {/* ---------------- patient context ---------------- */}
        <aside className="space-y-4 lg:order-2">
          <Card>
            <CardBody>
              <div className="flex items-center gap-3">
                <Avatar name={patientName} size="lg" />
                <div className="min-w-0">
                  <Link
                    href={`/patients/${appointment.patient.id}`}
                    className="block truncate text-[15px] font-semibold text-ink hover:text-brand-ink hover:underline"
                  >
                    {patientName}
                  </Link>
                  <p className="tabular text-sm text-ink-muted">
                    {appointment.patient.mrn} ·{" "}
                    {calculateAge(appointment.patient.dateOfBirth)} yrs
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
              </div>
            </CardBody>
          </Card>

          {appointment.patient.allergies ? (
            <Alert variant="warning" title="Allergies">
              {appointment.patient.allergies}
            </Alert>
          ) : null}

          {appointment.patient.chronicConditions ? (
            <Alert variant="info" title="Chronic conditions">
              {appointment.patient.chronicConditions}
            </Alert>
          ) : null}

          {appointment.notes ? (
            <Alert variant="info" title="Front-desk notes">
              {appointment.notes}
            </Alert>
          ) : null}

          <Card>
            <CardHeader
              title="Previous visits"
              description="Last 5 consultations"
              icon={<History className="h-4 w-4" aria-hidden />}
            />
            {history.length === 0 ? (
              <EmptyState
                title="First visit"
                description="This patient has no earlier consultations on record."
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {history.map((item) => (
                  <li key={item.id} className="px-5 py-3">
                    <Link
                      href={`/consultations/${item.id}`}
                      className="block"
                    >
                      <p className="text-sm font-medium text-ink hover:text-brand-ink hover:underline">
                        {item.diagnosis}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {formatDate(item.createdAt)} ·{" "}
                        {item.doctor.user.name}
                      </p>
                      {item.prescriptions.length > 0 ? (
                        <p className="mt-1 line-clamp-1 text-xs text-ink-secondary">
                          {item.prescriptions
                            .map((p) => `${p.medicineName} ${p.dosage}`)
                            .join(", ")}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
