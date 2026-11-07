import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { getAppointment } from "@/lib/services/appointment.service";
import { listBookableDoctors } from "@/lib/services/staff.service";
import { NotFoundError } from "@/lib/errors";
import { toDateInputValue } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { AppointmentForm } from "@/components/appointments/appointment-form";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Reschedule visit" };
export const dynamic = "force-dynamic";

export default async function RescheduleAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const [appointment, doctors] = await Promise.all([
    getAppointment(id).catch((error) => {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }),
    listBookableDoctors(),
  ]);

  const reschedulable = ["SCHEDULED", "CHECKED_IN"].includes(
    appointment.status,
  );

  const scheduled = new Date(appointment.scheduledAt);
  const time = `${String(scheduled.getHours()).padStart(2, "0")}:${String(scheduled.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumbs={[
          { label: "Appointments", href: "/appointments" },
          { label: appointment.code, href: `/appointments/${appointment.id}` },
          { label: "Reschedule" },
        ]}
        title={`Reschedule ${appointment.code}`}
        description={`${appointment.patient.firstName} ${appointment.patient.lastName} · ${appointment.patient.mrn}`}
      />

      {!reschedulable ? (
        <Card>
          <EmptyState
            title="This visit can no longer be rescheduled"
            description="Only scheduled or checked-in visits can be moved. Book a new visit instead."
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
      ) : (
        <AppointmentForm
          mode="reschedule"
          doctors={doctors}
          cancelHref={`/appointments/${appointment.id}`}
          defaults={{
            id: appointment.id,
            doctorId: appointment.doctorId,
            date: toDateInputValue(appointment.scheduledAt),
            time,
            durationMinutes: appointment.durationMinutes,
            type: appointment.type,
            reason: appointment.reason,
            notes: appointment.notes,
          }}
        />
      )}
    </div>
  );
}
