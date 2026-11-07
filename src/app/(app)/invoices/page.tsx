import Link from "next/link";
import type { Metadata } from "next";
import { ReceiptText, ShieldAlert } from "lucide-react";
import type { InvoiceStatus } from "@prisma/client";

import { requireSession } from "@/lib/auth/session";
import { listInvoices } from "@/lib/services/billing.service";
import { INVOICE_STATUS_OPTIONS, PAGE_SIZE } from "@/lib/constants";
import {
  formatCurrency,
  formatDate,
  readPage,
  readParam,
  type SearchParamsInput,
} from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Avatar, InvoiceStatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import {
  ClearFilters,
  FilterBar,
  FilterSelect,
  SearchInput,
} from "@/components/ui/filters";
import { Pagination } from "@/components/ui/pagination";
import {
  MobileList,
  MobileRow,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireSession();

  if (session.role === "DOCTOR") {
    return (
      <Card>
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
          title="Billing is restricted"
          description="Invoices and payments are handled by receptionist and administrator accounts."
          action={
            <Link href="/dashboard" className={buttonClasses("secondary", "md")}>
              Back to dashboard
            </Link>
          }
        />
      </Card>
    );
  }

  const params = await searchParams;
  const search = readParam(params, "q");
  const status = readParam(params, "status") as InvoiceStatus | undefined;
  const page = readPage(params);

  const { rows, total, pageCount, totals } = await listInvoices({
    search,
    status,
    page,
    pageSize: PAGE_SIZE,
  });

  const filtered = Boolean(search || status);

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Bills raised from consultations, and the payments recorded against them."
      />

      <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryTile label="Billed" value={formatCurrency(totals.billed)} />
        <SummaryTile
          label="Collected"
          value={formatCurrency(totals.collected)}
        />
        <SummaryTile
          label="Outstanding"
          value={formatCurrency(totals.outstanding)}
          emphasis={totals.outstanding > 0}
        />
      </section>

      <Card className="overflow-hidden">
        <FilterBar>
          <SearchInput
            placeholder="Search invoice number, patient or MRN…"
            label="Search invoices"
          />
          <FilterSelect
            paramName="status"
            label="Filter by status"
            allLabel="All statuses"
            options={INVOICE_STATUS_OPTIONS}
          />
          <ClearFilters keys={["q", "status"]} />
          <span className="ml-auto hidden text-sm text-ink-muted sm:block">
            {total} {total === 1 ? "invoice" : "invoices"}
          </span>
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="h-5 w-5" aria-hidden />}
            title={filtered ? "No invoices match those filters" : "No invoices yet"}
            description={
              filtered
                ? "Try a different search, or clear the filters."
                : "An invoice is raised from a completed consultation. Finish a visit, then bill it."
            }
            action={
              filtered ? (
                <Link href="/invoices" className={buttonClasses("secondary", "md")}>
                  Clear filters
                </Link>
              ) : (
                <Link
                  href="/consultations"
                  className={buttonClasses("primary", "md")}
                >
                  Find a visit to bill
                </Link>
              )
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Invoice</TH>
                    <TH>Patient</TH>
                    <TH>Issued</TH>
                    <TH align="right">Total</TH>
                    <TH align="right">Paid</TH>
                    <TH align="right">Balance</TH>
                    <TH>Status</TH>
                    <TH align="right">
                      <span className="sr-only">Actions</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((invoice) => {
                    const balance = Math.max(
                      0,
                      invoice.totalAmount - invoice.paidAmount,
                    );
                    return (
                      <TR key={invoice.id}>
                        <TD>
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="tabular font-medium text-ink hover:text-brand-ink hover:underline"
                          >
                            {invoice.number}
                          </Link>
                          <span className="block text-xs text-ink-muted">
                            {invoice._count.items} item
                            {invoice._count.items === 1 ? "" : "s"}
                          </span>
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              name={`${invoice.patient.firstName} ${invoice.patient.lastName}`}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <Link
                                href={`/patients/${invoice.patient.id}`}
                                className="block truncate font-medium text-ink hover:text-brand-ink hover:underline"
                              >
                                {invoice.patient.firstName}{" "}
                                {invoice.patient.lastName}
                              </Link>
                              <span className="tabular block text-xs text-ink-muted">
                                {invoice.patient.mrn}
                              </span>
                            </div>
                          </div>
                        </TD>
                        <TD className="whitespace-nowrap text-ink-muted">
                          {formatDate(invoice.issuedAt)}
                        </TD>
                        <TD align="right" className="tabular whitespace-nowrap">
                          {formatCurrency(invoice.totalAmount)}
                        </TD>
                        <TD
                          align="right"
                          className="tabular whitespace-nowrap text-ink-secondary"
                        >
                          {formatCurrency(invoice.paidAmount)}
                        </TD>
                        <TD
                          align="right"
                          className={`tabular whitespace-nowrap font-medium ${
                            balance > 0 && invoice.status !== "CANCELLED"
                              ? "text-[var(--danger)]"
                              : "text-ink-muted"
                          }`}
                        >
                          {invoice.status === "CANCELLED"
                            ? "—"
                            : formatCurrency(balance)}
                        </TD>
                        <TD>
                          <InvoiceStatusBadge status={invoice.status} />
                        </TD>
                        <TD align="right">
                          <Link
                            href={`/invoices/${invoice.id}`}
                            className={buttonClasses("secondary", "sm")}
                          >
                            Open
                          </Link>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>

            <MobileList>
              {rows.map((invoice) => {
                const balance = Math.max(
                  0,
                  invoice.totalAmount - invoice.paidAmount,
                );
                return (
                  <MobileRow key={invoice.id}>
                    <Link href={`/invoices/${invoice.id}`} className="block">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="tabular font-medium text-ink">
                            {invoice.number}
                          </p>
                          <p className="truncate text-xs text-ink-secondary">
                            {invoice.patient.firstName}{" "}
                            {invoice.patient.lastName} · {invoice.patient.mrn}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {formatDate(invoice.issuedAt)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="tabular font-semibold text-ink">
                            {formatCurrency(invoice.totalAmount)}
                          </p>
                          {balance > 0 && invoice.status !== "CANCELLED" ? (
                            <p className="tabular text-xs text-[var(--danger)]">
                              {formatCurrency(balance)} due
                            </p>
                          ) : null}
                          <div className="mt-1">
                            <InvoiceStatusBadge status={invoice.status} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </MobileRow>
                );
              })}
            </MobileList>

            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={PAGE_SIZE}
              basePath="/invoices"
              searchParams={params}
              label="invoices"
            />
          </>
        )}
      </Card>
    </>
  );
}

function SummaryTile({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p
        className={`tabular mt-1 text-lg font-semibold ${
          emphasis ? "text-[var(--danger)]" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
