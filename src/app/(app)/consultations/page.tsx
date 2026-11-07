import Link from "next/link";
import type { Metadata } from "next";
import { Pill, ReceiptText, Stethoscope } from "lucide-react";

import { requireSession } from "@/lib/auth/session";
import { listConsultations } from "@/lib/services/consultation.service";
import { listBookableDoctors } from "@/lib/services/staff.service";
import { PAGE_SIZE } from "@/lib/constants";
import {
  describeAge,
  endOfDay,
  formatDateTime,
  readPage,
  readParam,
  startOfDay,
  truncate,
  type SearchParamsInput,
} from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  AppointmentTypeBadge,
  Avatar,
  Badge,
  InvoiceStatusBadge,
} from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import {
  ClearFilters,
  DateFilter,
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

export const metadata: Metadata = { title: "Consultations" };
export const dynamic = "force-dynamic";

export default async function ConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const search = readParam(params, "q");
  const dateParam = readParam(params, "date");
  const page = readPage(params);

  // Doctors land on their own records by default; they can widen the filter.
  const doctorFilter =
    readParam(params, "doctorId") ??
    (session.role === "DOCTOR" ? session.doctorId : undefined);

  const day = dateParam ? new Date(`${dateParam}T00:00:00`) : undefined;
  const validDay = day && !Number.isNaN(day.getTime()) ? day : undefined;

  const [{ rows, total, pageCount }, doctors] = await Promise.all([
    listConsultations({
      search,
      doctorId: doctorFilter,
      from: validDay ? startOfDay(validDay) : undefined,
      to: validDay ? endOfDay(validDay) : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    listBookableDoctors(),
  ]);

  const canBill = session.role === "ADMIN" || session.role === "RECEPTIONIST";
  const filtered = Boolean(search || dateParam || readParam(params, "doctorId"));

  return (
    <>
      <PageHeader
        title="Consultations"
        description="Every clinical record written at the clinic, newest first."
      />

      <Card className="overflow-hidden">
        <FilterBar>
          <SearchInput
            placeholder="Search diagnosis, symptoms, patient or code…"
            label="Search consultations"
          />
          <FilterSelect
            paramName="doctorId"
            label="Filter by doctor"
            allLabel={session.role === "DOCTOR" ? "My records" : "All doctors"}
            options={doctors.map((doctor) => ({
              value: doctor.id,
              label: doctor.user.name,
            }))}
          />
          <DateFilter paramName="date" label="Filter by date" />
          <ClearFilters keys={["q", "doctorId", "date"]} />
          <span className="ml-auto hidden text-sm text-ink-muted sm:block">
            {total} {total === 1 ? "record" : "records"}
          </span>
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Stethoscope className="h-5 w-5" aria-hidden />}
            title={
              filtered
                ? "No consultations match those filters"
                : "No consultations recorded yet"
            }
            description={
              filtered
                ? "Try a different search, or clear the filters."
                : "A consultation is created when a doctor completes a checked-in visit."
            }
            action={
              filtered ? (
                <Link
                  href="/consultations"
                  className={buttonClasses("secondary", "md")}
                >
                  Clear filters
                </Link>
              ) : (
                <Link
                  href="/appointments"
                  className={buttonClasses("primary", "md")}
                >
                  Go to the diary
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
                    <TH>Recorded</TH>
                    <TH>Patient</TH>
                    <TH>Diagnosis</TH>
                    <TH>Doctor</TH>
                    <TH align="center">Rx</TH>
                    <TH>Billing</TH>
                    <TH align="right">
                      <span className="sr-only">Actions</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((consultation) => (
                    <TR key={consultation.id}>
                      <TD className="whitespace-nowrap">
                        <span className="block text-ink-secondary">
                          {formatDateTime(consultation.createdAt)}
                        </span>
                        <span className="tabular block text-xs text-ink-muted">
                          {consultation.appointment.code}
                        </span>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={`${consultation.patient.firstName} ${consultation.patient.lastName}`}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <Link
                              href={`/patients/${consultation.patient.id}`}
                              className="block truncate font-medium text-ink hover:text-brand-ink hover:underline"
                            >
                              {consultation.patient.firstName}{" "}
                              {consultation.patient.lastName}
                            </Link>
                            <span className="tabular block text-xs text-ink-muted">
                              {consultation.patient.mrn} ·{" "}
                              {describeAge(consultation.patient.dateOfBirth)}
                            </span>
                          </div>
                        </div>
                      </TD>
                      <TD className="max-w-[20rem]">
                        <span className="block font-medium text-ink">
                          {truncate(consultation.diagnosis, 70)}
                        </span>
                        <span className="mt-1 inline-block">
                          <AppointmentTypeBadge
                            type={consultation.appointment.type}
                          />
                        </span>
                      </TD>
                      <TD>
                        <span className="block truncate text-ink-secondary">
                          {consultation.doctor.user.name}
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                          {consultation.doctor.specialization}
                        </span>
                      </TD>
                      <TD align="center">
                        {consultation._count.prescriptions > 0 ? (
                          <span className="tabular inline-flex items-center gap-1 text-ink-secondary">
                            <Pill className="h-3.5 w-3.5" aria-hidden />
                            {consultation._count.prescriptions}
                          </span>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </TD>
                      <TD>
                        {consultation.invoice ? (
                          <Link
                            href={`/invoices/${consultation.invoice.id}`}
                            className="inline-flex items-center gap-1.5"
                          >
                            <InvoiceStatusBadge
                              status={consultation.invoice.status}
                            />
                          </Link>
                        ) : canBill ? (
                          <Link
                            href={`/invoices/new?consultationId=${consultation.id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-brand-ink hover:underline"
                          >
                            <ReceiptText className="h-3.5 w-3.5" aria-hidden />
                            Bill
                          </Link>
                        ) : (
                          <Badge tone="neutral">Not billed</Badge>
                        )}
                      </TD>
                      <TD align="right">
                        <Link
                          href={`/consultations/${consultation.id}`}
                          className={buttonClasses("secondary", "sm")}
                        >
                          Open
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <MobileList>
              {rows.map((consultation) => (
                <MobileRow key={consultation.id}>
                  <Link
                    href={`/consultations/${consultation.id}`}
                    className="flex items-start gap-3"
                  >
                    <Avatar
                      name={`${consultation.patient.firstName} ${consultation.patient.lastName}`}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">
                        {consultation.diagnosis}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-secondary">
                        {consultation.patient.firstName}{" "}
                        {consultation.patient.lastName} ·{" "}
                        {consultation.patient.mrn}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {formatDateTime(consultation.createdAt)} ·{" "}
                        {consultation.doctor.user.name}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {consultation.invoice ? (
                          <InvoiceStatusBadge
                            status={consultation.invoice.status}
                          />
                        ) : (
                          <Badge tone="neutral">Not billed</Badge>
                        )}
                        {consultation._count.prescriptions > 0 ? (
                          <Badge tone="neutral">
                            {consultation._count.prescriptions} Rx
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </MobileRow>
              ))}
            </MobileList>

            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={PAGE_SIZE}
              basePath="/consultations"
              searchParams={params}
              label="records"
            />
          </>
        )}
      </Card>
    </>
  );
}
