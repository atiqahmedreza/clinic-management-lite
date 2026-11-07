import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReceiptText } from "lucide-react";

import { requireSession } from "@/lib/auth/session";
import { getInvoiceDraft, listServices } from "@/lib/services/billing.service";
import { getPatientPickerOption } from "@/lib/services/patient.service";
import { AppError, NotFoundError } from "@/lib/errors";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/states";
import { buttonClasses } from "@/components/ui/button";
import { InvoiceBuilder } from "@/components/billing/invoice-builder";

export const metadata: Metadata = { title: "New invoice" };
export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ consultationId?: string; patientId?: string }>;
}) {
  const session = await requireSession();

  if (session.role === "DOCTOR") {
    return (
      <Card>
        <EmptyState
          icon={<ReceiptText className="h-5 w-5" aria-hidden />}
          title="Billing is handled at the front desk"
          description="Receptionist and administrator accounts raise invoices and take payments."
          action={
            <Link href="/dashboard" className={buttonClasses("secondary", "md")}>
              Back to dashboard
            </Link>
          }
        />
      </Card>
    );
  }

  const { consultationId, patientId } = await searchParams;

  // ---- billing a finished consultation (the normal path) ----
  if (consultationId) {
    let draft;
    try {
      draft = await getInvoiceDraft(consultationId);
    } catch (error) {
      if (error instanceof NotFoundError) notFound();
      if (error instanceof AppError) {
        return (
          <div className="mx-auto max-w-3xl">
            <PageHeader
              breadcrumbs={[
                { label: "Invoices", href: "/invoices" },
                { label: "New" },
              ]}
              title="Cannot raise this invoice"
            />
            <Alert variant="warning" title="This visit cannot be billed">
              {error.message}
            </Alert>
            <div className="mt-4 flex gap-2">
              <Link
                href={`/consultations/${consultationId}`}
                className={buttonClasses("secondary", "md")}
              >
                Open the consultation
              </Link>
              <Link href="/invoices" className={buttonClasses("ghost", "md")}>
                All invoices
              </Link>
            </div>
          </div>
        );
      }
      throw error;
    }

    const { consultation, services, suggestedItems } = draft;
    const patientLabel = `${consultation.patient.firstName} ${consultation.patient.lastName} (${consultation.patient.mrn})`;

    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader
          breadcrumbs={[
            { label: "Invoices", href: "/invoices" },
            { label: "New" },
          ]}
          title="Raise an invoice"
          description={`Step 4 of the workflow · ${patientLabel} · ${formatDateTime(consultation.createdAt)}`}
        />

        <Alert variant="info" className="mb-4">
          Billing visit <strong>{consultation.appointment.code}</strong> —{" "}
          {consultation.diagnosis}. The consultation fee for{" "}
          {consultation.doctor.user.name} is already on the invoice.
        </Alert>

        <InvoiceBuilder
          patientId={consultation.patient.id}
          patientLabel={patientLabel}
          consultationId={consultation.id}
          services={services}
          initialItems={suggestedItems}
          cancelHref={`/consultations/${consultation.id}`}
        />
      </div>
    );
  }

  // ---- a standalone invoice (walk-in lab test, dressing, etc.) ----
  const [patient, services] = await Promise.all([
    patientId ? getPatientPickerOption(patientId) : Promise.resolve(null),
    listServices(),
  ]);

  if (!patient) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "New" }]}
          title="Raise an invoice"
        />
        <Card>
          <EmptyState
            icon={<ReceiptText className="h-5 w-5" aria-hidden />}
            title="Pick a patient first"
            description="Invoices normally start from a completed consultation. For a walk-in charge, open the patient and use their profile."
            action={
              <Link href="/patients" className={buttonClasses("primary", "md")}>
                Find a patient
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const patientLabel = `${patient.firstName} ${patient.lastName} (${patient.mrn})`;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        breadcrumbs={[{ label: "Invoices", href: "/invoices" }, { label: "New" }]}
        title="Raise an invoice"
        description={patientLabel}
      />
      <InvoiceBuilder
        patientId={patient.id}
        patientLabel={patientLabel}
        services={services}
        initialItems={[]}
        cancelHref={`/patients/${patient.id}`}
      />
    </div>
  );
}
