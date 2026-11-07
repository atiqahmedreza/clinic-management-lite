import Link from "next/link";
import type { Metadata } from "next";
import { CalendarPlus, Stethoscope } from "lucide-react";

import { requireSession } from "@/lib/auth/session";
import { listDoctors } from "@/lib/services/staff.service";
import { WEEKDAYS } from "@/lib/constants";
import { formatClockTime, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Avatar, Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Doctors" };
export const dynamic = "force-dynamic";

export default async function DoctorsPage() {
  const session = await requireSession();
  const doctors = await listDoctors();

  return (
    <>
      <PageHeader
        title="Doctors"
        description="Clinic days, working hours and consultation fees. These drive which appointment slots the booking form offers."
        actions={
          session.role === "ADMIN" ? (
            <Link href="/staff" className={buttonClasses("secondary", "md")}>
              Manage accounts
            </Link>
          ) : null
        }
      />

      {doctors.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Stethoscope className="h-5 w-5" aria-hidden />}
            title="No doctors yet"
            description="Create a staff account with the doctor role to start booking visits."
            action={
              session.role === "ADMIN" ? (
                <Link href="/staff" className={buttonClasses("primary", "md")}>
                  Add a doctor
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {doctors.map((doctor) => {
            const bookable = doctor.isAcceptingPatients && doctor.user.isActive;
            return (
              <Card key={doctor.id} className="flex flex-col">
                <CardBody className="flex-1">
                  <div className="flex items-start gap-3">
                    <Avatar name={doctor.user.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/doctors/${doctor.id}`}
                        className="block truncate text-[15px] font-semibold text-ink hover:text-brand-ink hover:underline"
                      >
                        {doctor.user.name}
                      </Link>
                      <p className="truncate text-sm text-ink-secondary">
                        {doctor.specialization}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {doctor.qualifications}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {bookable ? (
                          <Badge tone="success" dot>
                            Accepting bookings
                          </Badge>
                        ) : (
                          <Badge tone="neutral" dot>
                            Not accepting
                          </Badge>
                        )}
                        {doctor.roomNumber ? (
                          <Badge tone="neutral">Room {doctor.roomNumber}</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <dl className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-ink-muted">Consultation fee</dt>
                      <dd className="tabular font-semibold text-ink">
                        {formatCurrency(doctor.consultationFee)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-ink-muted">Hours</dt>
                      <dd className="tabular text-ink">
                        {formatClockTime(doctor.startTime)} –{" "}
                        {formatClockTime(doctor.endTime)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-ink-muted">Visits completed</dt>
                      <dd className="tabular text-ink">
                        {doctor._count.consultations}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {WEEKDAYS.map((weekday) => {
                      const works = doctor.availableDays.includes(weekday.value);
                      return (
                        <span
                          key={weekday.value}
                          title={`${weekday.label}: ${works ? "clinic" : "off"}`}
                          className={
                            works
                              ? "rounded px-1.5 py-0.5 text-[11px] font-medium bg-brand-soft text-brand-ink"
                              : "rounded px-1.5 py-0.5 text-[11px] font-medium bg-surface-muted text-ink-muted line-through"
                          }
                        >
                          {weekday.short}
                        </span>
                      );
                    })}
                  </div>
                </CardBody>

                <div className="flex gap-2 border-t border-line p-3">
                  <Link
                    href={`/doctors/${doctor.id}`}
                    className={buttonClasses("secondary", "sm", "flex-1")}
                  >
                    Profile
                  </Link>
                  {bookable ? (
                    <Link
                      href={`/appointments/new?doctorId=${doctor.id}`}
                      className={buttonClasses("primary", "sm", "flex-1")}
                    >
                      <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
                      Book
                    </Link>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
