import type { Metadata } from "next";

import { requireSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { PatientForm } from "@/components/patients/patient-form";

export const metadata: Metadata = { title: "Register patient" };

export default async function NewPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requireSession();
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumbs={[{ label: "Patients", href: "/patients" }, { label: "Register" }]}
        title="Register a new patient"
        description="Step 1 of the clinic workflow. A medical record number is issued automatically."
      />
      <PatientForm
        mode="create"
        onSuccess={next === "book" ? "book" : "profile"}
      />
    </div>
  );
}
