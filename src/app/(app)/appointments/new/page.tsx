import Link from "next/link";
import type { Metadata } from "next";
import { CalendarX2 } from "lucide-react";

import { requireSession } from "@/lib/auth/session";
import { listBookableDoctors } from "@/lib/services/staff.service";
import { getPatientPickerOption } from "@/lib/services/patient.service";
import { PageHeader } from "@/components/layout/page-header";
import { AppointmentForm } from "@/components/appointments/appointment-form";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Book a visit" };
export const dynamic = "force-dynamic";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; doctorId?: string }>;
}) {
  await requireSession();
  const { patientId, doctorId } = await searchParams;

  const [doctors, patient] = await Promise.all([
    listBookableDoctors(),
    patientId ? getPatientPickerOption(patientId) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumbs={[
          { label: "Appointments", href: "/appointments" },
          { label: "Book" },
        ]}
        title="Book a visit"
        description="Step 2 of the workflow. The diary is checked live — a slot that is already taken cannot be booked."
      />

      {doctors.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarX2 className="h-5 w-5" aria-hidden />}
            title="No doctors are accepting bookings"
            description="Add a doctor account, or switch an existing one back to accepting patients, before booking a visit."
            action={
              <Link href="/doctors" className={buttonClasses("primary", "md")}>
                Manage doctors
              </Link>
            }
          />
        </Card>
      ) : (
        <AppointmentForm
          mode="create"
          doctors={doctors}
          defaults={{
            patient,
            doctorId: doctorId ?? doctors[0]?.id,
          }}
        />
      )}
    </div>
  );
}
