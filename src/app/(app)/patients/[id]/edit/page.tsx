import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { getPatientForEdit } from "@/lib/services/patient.service";
import { NotFoundError } from "@/lib/errors";
import { PageHeader } from "@/components/layout/page-header";
import { PatientForm } from "@/components/patients/patient-form";

export const metadata: Metadata = { title: "Edit patient" };

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const patient = await getPatientForEdit(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumbs={[
          { label: "Patients", href: "/patients" },
          {
            label: `${patient.firstName} ${patient.lastName}`,
            href: `/patients/${patient.id}`,
          },
          { label: "Edit" },
        ]}
        title={`Edit ${patient.firstName} ${patient.lastName}`}
        description={`Medical record ${patient.mrn}`}
      />
      <PatientForm
        mode="edit"
        cancelHref={`/patients/${patient.id}`}
        defaults={{
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          phone: patient.phone,
          email: patient.email,
          address: patient.address,
          city: patient.city,
          bloodGroup: patient.bloodGroup,
          allergies: patient.allergies,
          chronicConditions: patient.chronicConditions,
          emergencyContactName: patient.emergencyContactName,
          emergencyContactPhone: patient.emergencyContactPhone,
          isActive: patient.isActive,
        }}
      />
    </div>
  );
}
