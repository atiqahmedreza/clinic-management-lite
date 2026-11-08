import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getInvoice } from "@/lib/services/billing.service";
import { NotFoundError } from "@/lib/errors";
import { CLINIC, PAYMENT_METHOD_META } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { AutoPrint } from "./auto-print";

export const metadata: Metadata = {
  title: "Receipt",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Print-friendly receipt. Rendered outside the application shell so the sheet
 * carries only the clinic letterhead, the charges and the payments.
 */
export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "DOCTOR") redirect("/dashboard");

  const { id } = await params;
  const invoice = await getInvoice(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const patientName = `${invoice.patient.firstName} ${invoice.patient.lastName}`;

  return (
    <main className="mx-auto max-w-[820px] bg-white p-8 text-[13px] leading-relaxed text-black print:p-0">
      <AutoPrint />

      {/* ---- letterhead ---- */}
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div>
          <h1 className="display text-[1.5rem] tracking-tight">{CLINIC.name}</h1>
          <p className="mt-0.5 text-[12px]">{CLINIC.tagline}</p>
          <p className="mt-2 text-[12px]">
            {CLINIC.addressLine1}
            <br />
            {CLINIC.addressLine2}
            <br />
            {CLINIC.phone} · {CLINIC.email}
          </p>
          <p className="mt-1 text-[11px]">Reg. {CLINIC.registration}</p>
        </div>
        <div className="text-right">
          <p className="display text-[1.125rem] uppercase tracking-wide">
            {invoice.status === "CANCELLED" ? "Cancelled invoice" : "Invoice"}
          </p>
          <p className="mt-1 font-mono text-base font-semibold">
            {invoice.number}
          </p>
          <p className="mt-1 text-[12px]">
            Issued {formatDate(invoice.issuedAt)}
          </p>
          <p className="mt-2 inline-block border border-black px-2 py-0.5 text-[11px] font-semibold uppercase">
            {invoice.status.replace("_", " ")}
          </p>
        </div>
      </header>

      {/* ---- parties ---- */}
      <section className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide">
            Billed to
          </p>
          <p className="mt-1 font-semibold">{patientName}</p>
          <p className="font-mono text-[12px]">{invoice.patient.mrn}</p>
          <p className="text-[12px]">{invoice.patient.phone}</p>
          {invoice.patient.address || invoice.patient.city ? (
            <p className="text-[12px]">
              {[invoice.patient.address, invoice.patient.city]
                .filter(Boolean)
                .join(", ")}
            </p>
          ) : null}
        </div>

        {invoice.consultation ? (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide">
              Visit
            </p>
            <p className="mt-1 font-mono text-[12px]">
              {invoice.consultation.appointment.code}
            </p>
            <p className="text-[12px]">
              {formatDateTime(invoice.consultation.appointment.scheduledAt)}
            </p>
            <p className="text-[12px]">
              {invoice.consultation.doctor.user.name} (
              {invoice.consultation.doctor.specialization})
            </p>
            <p className="text-[12px]">
              Diagnosis: {invoice.consultation.diagnosis}
            </p>
          </div>
        ) : null}
      </section>

      {/* ---- charges ---- */}
      <table className="mt-6 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-black">
            <th className="py-2 text-left font-bold uppercase tracking-wide">
              Description
            </th>
            <th className="w-16 py-2 text-center font-bold uppercase tracking-wide">
              Qty
            </th>
            <th className="w-28 py-2 text-right font-bold uppercase tracking-wide">
              Unit
            </th>
            <th className="w-32 py-2 text-right font-bold uppercase tracking-wide">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.id} className="border-b border-[#d6cec1]">
              <td className="py-2">
                {item.description}
                {item.service ? (
                  <span className="ml-2 font-mono text-[11px] text-[#5a534b]">
                    {item.service.code}
                  </span>
                ) : null}
              </td>
              <td className="py-2 text-center tabular-nums">{item.quantity}</td>
              <td className="py-2 text-right tabular-nums">
                {formatCurrency(item.unitPrice)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatCurrency(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---- totals ---- */}
      <section className="mt-4 flex justify-end">
        <dl className="w-72 space-y-1 text-[12px]">
          <Row label="Subtotal" value={invoice.subtotal} />
          {invoice.discountAmount > 0 ? (
            <Row label="Discount" value={-invoice.discountAmount} />
          ) : null}
          {invoice.taxAmount > 0 ? (
            <Row label="Tax / VAT" value={invoice.taxAmount} />
          ) : null}
          <div className="border-t border-black pt-1">
            <Row label="Total" value={invoice.totalAmount} bold />
          </div>
          <Row label="Paid" value={invoice.paidAmount} />
          <div className="border-t border-black pt-1">
            <Row
              label="Balance due"
              value={invoice.status === "CANCELLED" ? 0 : invoice.balanceDue}
              bold
            />
          </div>
        </dl>
      </section>

      {/* ---- payments ---- */}
      {invoice.payments.length > 0 ? (
        <section className="mt-6">
          <p className="text-[11px] font-bold uppercase tracking-wide">
            Payments received
          </p>
          <table className="mt-2 w-full border-collapse text-[12px]">
            <tbody>
              {invoice.payments.map((payment) => (
                <tr key={payment.id} className="border-b border-[#d6cec1]">
                  <td className="py-1.5">{formatDateTime(payment.paidAt)}</td>
                  <td className="py-1.5">
                    {PAYMENT_METHOD_META[payment.method]}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatCurrency(payment.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {invoice.notes ? (
        <section className="mt-5 whitespace-pre-line text-[12px]">
          <p className="text-[11px] font-bold uppercase tracking-wide">Notes</p>
          <p className="mt-1">{invoice.notes}</p>
        </section>
      ) : null}

      {/* ---- footer ---- */}
      <footer className="mt-10 flex items-end justify-between gap-8 border-t border-[#d6cec1] pt-4 text-[11px]">
        <p>
          This is a computer-generated invoice.
          {invoice.createdBy ? ` Raised by ${invoice.createdBy.name}.` : ""}
          <br />
          Printed {formatDateTime(new Date())}
        </p>
        <p className="text-center">
          ____________________________
          <br />
          Authorised signature
        </p>
      </footer>

      <p className="mt-8 text-center text-[12px] text-[#5a534b] print:hidden">
        The print dialog opens automatically. Choose &ldquo;Save as PDF&rdquo;
        to keep a copy.
      </p>
    </main>
  );
}

function Row({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={bold ? "font-bold" : ""}>{label}</dt>
      <dd className={`tabular-nums ${bold ? "font-bold" : ""}`}>
        {formatCurrency(value)}
      </dd>
    </div>
  );
}
