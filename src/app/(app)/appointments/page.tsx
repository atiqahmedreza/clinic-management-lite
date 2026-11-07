import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, CalendarPlus } from "lucide-react";
import type { AppointmentStatus } from "@prisma/client";

import { requireSession } from "@/lib/auth/session";
import { listAppointments } from "@/lib/services/appointment.service";
import { listBookableDoctors } from "@/lib/services/staff.service";
import { APPOINTMENT_STATUS_OPTIONS, PAGE_SIZE } from "@/lib/constants";
import {
  describeAge,
  endOfDay,
  formatFriendlyDateTime,
  readPage,
  readParam,
  startOfDay,
  type SearchParamsInput,
} from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  AppointmentStatusBadge,
  AppointmentTypeBadge,
  Avatar,
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
import { AppointmentStatusActions } from "@/components/appointments/status-actions";

export const metadata: Metadata = { title: "Appointments" };
export const dynamic = "force-dynamic";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const search = readParam(params, "q");
  const status = readParam(params, "status") as AppointmentStatus | undefined;
  const doctorId = readParam(params, "doctorId");
  const dateParam = readParam(params, "date");
  const page = readPage(params);

  const day = dateParam ? new Date(`${dateParam}T00:00:00`) : undefined;
  const validDay = day && !Number.isNaN(day.getTime()) ? day : undefined;

  const [{ rows, total, pageCount }, doctors] = await Promise.all([
    listAppointments({
      search,
      status,
      doctorId,
      from: validDay ? startOfDay(validDay) : undefined,
      to: validDay ? endOfDay(validDay) : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    listBookableDoctors(),
  ]);

  const filtered = Boolean(search || status || doctorId || dateParam);

  return (
    <>
      <PageHeader
        title="Appointments"
        description="The clinic diary. Check patients in, start consultations and close visits from here."
        actions={
          <Link
            href="/appointments/new"
            className={buttonClasses("primary", "md")}
          >
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Book visit
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <FilterBar>
          <SearchInput
            placeholder="Search code, patient, doctor or reason…"
            label="Search appointments"
          />
          <FilterSelect
            paramName="status"
            label="Filter by status"
            allLabel="All statuses"
            options={APPOINTMENT_STATUS_OPTIONS}
          />
          <FilterSelect
            paramName="doctorId"
            label="Filter by doctor"
            allLabel="All doctors"
            options={doctors.map((doctor) => ({
              value: doctor.id,
              label: doctor.user.name,
            }))}
          />
          <DateFilter paramName="date" label="Filter by date" />
          <ClearFilters keys={["q", "status", "doctorId", "date"]} />
          <span className="ml-auto hidden text-sm text-ink-muted sm:block">
            {total} {total === 1 ? "visit" : "visits"}
          </span>
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-5 w-5" aria-hidden />}
            title={filtered ? "No visits match those filters" : "The diary is empty"}
            description={
              filtered
                ? "Try a wider date range, or clear the filters to see every booking."
                : "Book the first visit to start the workflow."
            }
            action={
              filtered ? (
                <Link
                  href="/appointments"
                  className={buttonClasses("secondary", "md")}
                >
                  Clear filters
                </Link>
              ) : (
                <Link
                  href="/appointments/new"
                  className={buttonClasses("primary", "md")}
                >
                  <CalendarPlus className="h-4 w-4" aria-hidden />
                  Book visit
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
                    <TH>When</TH>
                    <TH>Patient</TH>
                    <TH>Doctor</TH>
                    <TH>Reason</TH>
                    <TH>Status</TH>
                    <TH align="right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((appointment) => (
                    <TR key={appointment.id}>
                      <TD>
                        <Link
                          href={`/appointments/${appointment.id}`}
                          className="block whitespace-nowrap font-medium text-ink hover:text-brand-ink hover:underline"
                        >
                          {formatFriendlyDateTime(appointment.scheduledAt)}
                        </Link>
                        <span className="tabular text-xs text-ink-muted">
                          {appointment.code} · {appointment.durationMinutes} min
                        </span>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={`${appointment.patient.firstName} ${appointment.patient.lastName}`}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <Link
                              href={`/patients/${appointment.patient.id}`}
                              className="block truncate font-medium text-ink hover:text-brand-ink hover:underline"
                            >
                              {appointment.patient.firstName}{" "}
                              {appointment.patient.lastName}
                            </Link>
                            <span className="tabular block truncate text-xs text-ink-muted">
                              {appointment.patient.mrn} ·{" "}
                              {describeAge(appointment.patient.dateOfBirth)}
                            </span>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <span className="block truncate text-ink-secondary">
                          {appointment.doctor.user.name}
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                          {appointment.doctor.specialization}
                        </span>
                      </TD>
                      <TD className="max-w-[18rem]">
                        <span className="line-clamp-2 text-ink-secondary">
                          {appointment.reason}
                        </span>
                        <span className="mt-1 inline-block">
                          <AppointmentTypeBadge type={appointment.type} />
                        </span>
                      </TD>
                      <TD>
                        <AppointmentStatusBadge status={appointment.status} />
                      </TD>
                      <TD align="right">
                        <div className="flex justify-end">
                          <AppointmentStatusActions
                            appointmentId={appointment.id}
                            status={appointment.status}
                            doctorId={appointment.doctor.id}
                            viewer={{
                              role: session.role,
                              doctorId: session.doctorId,
                            }}
                          />
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <MobileList>
              {rows.map((appointment) => (
                <MobileRow key={appointment.id}>
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={`${appointment.patient.firstName} ${appointment.patient.lastName}`}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/appointments/${appointment.id}`}
                        className="block truncate font-medium text-ink"
                      >
                        {appointment.patient.firstName}{" "}
                        {appointment.patient.lastName}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-secondary">
                        {formatFriendlyDateTime(appointment.scheduledAt)}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {appointment.doctor.user.name} · {appointment.code}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-secondary">
                        {appointment.reason}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <AppointmentStatusBadge status={appointment.status} />
                        <AppointmentTypeBadge type={appointment.type} />
                      </div>
                      <div className="mt-2.5">
                        <AppointmentStatusActions
                          appointmentId={appointment.id}
                          status={appointment.status}
                          doctorId={appointment.doctor.id}
                          viewer={{
                            role: session.role,
                            doctorId: session.doctorId,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </MobileRow>
              ))}
            </MobileList>

            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={PAGE_SIZE}
              basePath="/appointments"
              searchParams={params}
              label="visits"
            />
          </>
        )}
      </Card>
    </>
  );
}
