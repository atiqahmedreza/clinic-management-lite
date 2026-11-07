import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  Printer,
  ReceiptText,
  Stethoscope,
  Wallet,
} from "lucide-react";

import { requireSession } from "@/lib/auth/session";
import { getInvoice } from "@/lib/services/billing.service";
import { NotFoundError } from "@/lib/errors";
import { CLINIC, PAYMENT_METHOD_META } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, DataRow } from "@/components/ui/card";
import { Avatar, InvoiceStatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/states";
import {
  CancelInvoiceButton,
  PaymentForm,
} from "@/components/billing/payment-form";
import {
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const invoice = await getInvoice(id);
    return { title: `Invoice ${invoice.number}` };
  } catch {
    return { title: "Invoice" };
  }
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  if (session.role === "DOCTOR") {
    return (
      <Card>
        <EmptyState
          icon={<ReceiptText className="h-5 w-5" aria-hidden />}
          title="Billing is restricted"
          description="Invoices are handled by receptionist and administrator accounts."
          action={
            <Link href="/dashboard" className={buttonClasses("secondary", "md")}>
              Back to dashboard
            </Link>
          }
        />
      </Card>
    );
  }

  const invoice = await getInvoice(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const patientName = `${invoice.patient.firstName} ${invoice.patient.lastName}`;
  const cancelled = invoice.status === "CANCELLED";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Invoices", href: "/invoices" },
          { label: invoice.number },
        ]}
        title={
          <span className="tabular flex flex-wrap items-center gap-3">
            {invoice.number}
            <InvoiceStatusBadge status={invoice.status} />
          </span>
        }
        description={`${patientName} · ${invoice.patient.mrn} · issued ${formatDate(invoice.issuedAt)}`}
        actions={
          <>
            <Link
              href={`/invoices/${invoice.id}/print`}
              target="_blank"
              className={buttonClasses("secondary", "md")}
            >
              <Printer className="h-4 w-4" aria-hidden />
              Print receipt
            </Link>
            {!cancelled ? (
              <CancelInvoiceButton
                invoiceId={invoice.id}
                invoiceNumber={invoice.number}
                hasPayments={invoice.payments.length > 0}
              />
            ) : null}
          </>
        }
      />

      {cancelled ? (
        <Alert variant="error" title="This invoice was cancelled" className="mb-4">
          It no longer counts towards revenue or outstanding dues.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        {/* ---------------- the bill ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Charges"
              icon={<ReceiptText className="h-4 w-4" aria-hidden />}
              action={
                <span className="text-sm text-ink-muted">
                  {CLINIC.name}
                </span>
              }
            />

            <TableWrap className="block overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Description</TH>
                    <TH align="center">Qty</TH>
                    <TH align="right">Unit price</TH>
                    <TH align="right">Amount</TH>
                  </TR>
                </THead>
                <TBody>
                  {invoice.items.map((item) => (
                    <TR key={item.id}>
                      <TD>
                        <span className="font-medium text-ink">
                          {item.description}
                        </span>
                        {item.service ? (
                          <span className="tabular block text-xs text-ink-muted">
                            {item.service.code}
                          </span>
                        ) : null}
                      </TD>
                      <TD align="center" className="tabular">
                        {item.quantity}
                      </TD>
                      <TD align="right" className="tabular text-ink-secondary">
                        {formatCurrency(item.unitPrice)}
                      </TD>
                      <TD align="right" className="tabular font-medium">
                        {formatCurrency(item.lineTotal)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <CardBody className="border-t border-line">
              <dl className="ml-auto max-w-xs space-y-2">
                <TotalRow label="Subtotal" value={invoice.subtotal} />
                {invoice.discountAmount > 0 ? (
                  <TotalRow label="Discount" value={-invoice.discountAmount} />
                ) : null}
                {invoice.taxAmount > 0 ? (
                  <TotalRow label="Tax" value={invoice.taxAmount} />
                ) : null}
                <div className="border-t border-line pt-2">
                  <TotalRow label="Total" value={invoice.totalAmount} emphasis />
                </div>
                <TotalRow label="Paid" value={invoice.paidAmount} />
                <div className="border-t border-line pt-2">
                  <TotalRow
                    label="Balance due"
                    value={cancelled ? 0 : invoice.balanceDue}
                    emphasis
                    danger={!cancelled && invoice.balanceDue > 0}
                  />
                </div>
              </dl>

              {invoice.notes ? (
                <p className="mt-4 whitespace-pre-line border-t border-line pt-4 text-sm text-ink-secondary">
                  {invoice.notes}
                </p>
              ) : null}
            </CardBody>
          </Card>

          {/* ---------------- payments ---------------- */}
          <Card>
            <CardHeader
              title="Payments"
              description={`${invoice.payments.length} recorded`}
              icon={<Wallet className="h-4 w-4" aria-hidden />}
            />
            {invoice.payments.length === 0 ? (
              <EmptyState
                title="No payments yet"
                description="Record the first payment from the panel on the right."
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {invoice.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {PAYMENT_METHOD_META[payment.method]}
                        {payment.reference ? (
                          <span className="tabular ml-2 font-normal text-ink-muted">
                            {payment.reference}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {formatDateTime(payment.paidAt)}
                        {payment.receivedBy
                          ? ` · received by ${payment.receivedBy.name}`
                          : ""}
                      </p>
                      {payment.note ? (
                        <p className="mt-0.5 text-xs text-ink-secondary">
                          {payment.note}
                        </p>
                      ) : null}
                    </div>
                    <span className="tabular shrink-0 text-sm font-semibold text-ink">
                      {formatCurrency(payment.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ---------------- sidebar ---------------- */}
        <aside className="space-y-4">
          {!cancelled ? (
            <PaymentForm
              invoiceId={invoice.id}
              balanceDue={invoice.balanceDue}
            />
          ) : null}

          <Card>
            <CardHeader title="Patient" />
            <CardBody>
              <Link
                href={`/patients/${invoice.patient.id}`}
                className="flex items-center gap-3"
              >
                <Avatar name={patientName} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink hover:text-brand-ink hover:underline">
                    {patientName}
                  </p>
                  <p className="tabular text-xs text-ink-muted">
                    {invoice.patient.mrn} · {invoice.patient.phone}
                  </p>
                </div>
              </Link>
            </CardBody>
          </Card>

          {invoice.consultation ? (
            <Card>
              <CardHeader
                title="Billed visit"
                icon={<Stethoscope className="h-4 w-4" aria-hidden />}
              />
              <CardBody>
                <dl className="divide-y divide-[var(--border)]">
                  <DataRow
                    label="Diagnosis"
                    value={invoice.consultation.diagnosis}
                  />
                  <DataRow
                    label="Attending doctor"
                    value={`${invoice.consultation.doctor.user.name} · ${invoice.consultation.doctor.specialization}`}
                  />
                  <DataRow
                    label="Visit"
                    value={
                      <span className="tabular">
                        {invoice.consultation.appointment.code}
                      </span>
                    }
                  />
                  <DataRow
                    label="Seen on"
                    value={formatDateTime(invoice.consultation.createdAt)}
                  />
                </dl>
                <Link
                  href={`/consultations/${invoice.consultation.id}`}
                  className={buttonClasses("secondary", "md", "mt-4 w-full")}
                >
                  Open clinical record
                </Link>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="flex items-start gap-3">
                <CalendarClock
                  className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted"
                  aria-hidden
                />
                <p className="text-sm text-ink-secondary">
                  This is a standalone invoice — it is not attached to a
                  consultation.
                </p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody>
              <dl className="divide-y divide-[var(--border)]">
                <DataRow label="Issued" value={formatDateTime(invoice.issuedAt)} />
                {invoice.createdBy ? (
                  <DataRow label="Raised by" value={invoice.createdBy.name} />
                ) : null}
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

function TotalRow({
  label,
  value,
  emphasis = false,
  danger = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt
        className={
          emphasis
            ? "text-sm font-semibold text-ink"
            : "text-sm text-ink-secondary"
        }
      >
        {label}
      </dt>
      <dd
        className={[
          "tabular text-sm",
          emphasis ? "text-base font-semibold" : "",
          danger ? "text-[var(--danger)]" : "text-ink",
        ].join(" ")}
      >
        {formatCurrency(value)}
      </dd>
    </div>
  );
}
