import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarPlus, Clock3, Stethoscope } from "lucide-react";

import { requireSession } from "@/lib/auth/session";
import { getDoctorProfile } from "@/lib/services/staff.service";
import { NotFoundError } from "@/lib/errors";
import { WEEKDAYS } from "@/lib/constants";
import { formatClockTime, formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, DataRow } from "@/components/ui/card";
import { Avatar, Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const doctor = await getDoctorProfile(id);
    return { title: doctor.user.name };
  } catch {
    return { title: "Doctor" };
  }
}

export default async function DoctorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const doctor = await getDoctorProfile(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const bookable = doctor.isAcceptingPatients && doctor.user.isActive;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Doctors", href: "/doctors" },
          { label: doctor.user.name },
        ]}
        title={doctor.user.name}
        description={`${doctor.specialization} · ${doctor.qualifications}`}
        actions={
          <>
            {session.role === "ADMIN" ? (
              <Link
                href={`/staff?edit=${doctor.userId}`}
                className={buttonClasses("secondary", "md")}
              >
                Edit profile
              </Link>
            ) : null}
            {bookable ? (
              <Link
                href={`/appointments/new?doctorId=${doctor.id}`}
                className={buttonClasses("primary", "md")}
              >
                <CalendarPlus className="h-4 w-4" aria-hidden />
                Book with {doctor.user.name.split(" ")[0]}
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardBody>
              <div className="flex items-center gap-3">
                <Avatar name={doctor.user.name} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink">
                    {doctor.user.name}
                  </p>
                  <p className="truncate text-sm text-ink-muted">
                    {doctor.specialization}
                  </p>
                  <div className="mt-1.5">
                    {bookable ? (
                      <Badge tone="success" dot>
                        Accepting bookings
                      </Badge>
                    ) : (
                      <Badge tone="neutral" dot>
                        Not accepting
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {doctor.bio ? (
                <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
                  {doctor.bio}
                </p>
              ) : null}

              <dl className="mt-4 divide-y divide-[var(--border)]">
                <DataRow label="Qualifications" value={doctor.qualifications} />
                <DataRow
                  label="License"
                  value={<span className="tabular">{doctor.licenseNumber}</span>}
                />
                <DataRow
                  label="Consultation fee"
                  value={
                    <span className="tabular font-semibold">
                      {formatCurrency(doctor.consultationFee)}
                    </span>
                  }
                />
                {doctor.roomNumber ? (
                  <DataRow label="Room" value={doctor.roomNumber} />
                ) : null}
                <DataRow label="Email" value={doctor.user.email} />
                {doctor.user.phone ? (
                  <DataRow label="Phone" value={doctor.user.phone} />
                ) : null}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Availability"
              icon={<Clock3 className="h-4 w-4" aria-hidden />}
            />
            <CardBody>
              <p className="tabular text-sm text-ink">
                {formatClockTime(doctor.startTime)} –{" "}
                {formatClockTime(doctor.endTime)}
                <span className="ml-2 text-ink-muted">
                  · {doctor.slotMinutes}-minute slots
                </span>
              </p>
              <ul className="mt-3 space-y-1.5">
                {WEEKDAYS.map((weekday) => {
                  const works = doctor.availableDays.includes(weekday.value);
                  return (
                    <li
                      key={weekday.value}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span
                        className={works ? "text-ink" : "text-ink-muted"}
                      >
                        {weekday.label}
                      </span>
                      <span
                        className={
                          works
                            ? "tabular text-ink-secondary"
                            : "text-ink-muted"
                        }
                      >
                        {works
                          ? `${formatClockTime(doctor.startTime)} – ${formatClockTime(doctor.endTime)}`
                          : "Closed"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-4">
            <div className="card p-5">
              <p className="text-sm font-medium text-ink-secondary">
                Upcoming visits
              </p>
              <p className="tabular mt-2 text-2xl font-semibold text-ink">
                {doctor.stats.upcoming}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-sm font-medium text-ink-secondary">
                Completed visits
              </p>
              <p className="tabular mt-2 text-2xl font-semibold text-ink">
                {doctor.stats.completed}
              </p>
            </div>
          </section>

          <Card>
            <CardHeader
              title="Recent consultations"
              icon={<Stethoscope className="h-4 w-4" aria-hidden />}
              action={
                <Link
                  href={`/consultations?doctorId=${doctor.id}`}
                  className="text-sm font-medium text-brand-ink hover:underline"
                >
                  View all
                </Link>
              }
            />
            {doctor.recentConsultations.length === 0 ? (
              <EmptyState
                title="No consultations recorded"
                description="Records appear here once this doctor completes a visit."
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {doctor.recentConsultations.map((consultation) => (
                  <li key={consultation.id}>
                    <Link
                      href={`/consultations/${consultation.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-muted"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {consultation.diagnosis}
                        </p>
                        <p className="tabular truncate text-xs text-ink-muted">
                          {consultation.patient.firstName}{" "}
                          {consultation.patient.lastName} ·{" "}
                          {consultation.patient.mrn}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-ink-muted">
                        {formatDate(consultation.createdAt)}
                      </span>
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
