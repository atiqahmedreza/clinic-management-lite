import Link from "next/link";
import type { Metadata } from "next";
import {
  Activity,
  Wallet,
  CalendarCheck2,
  CalendarClock,
  ClipboardList,
  Clock3,
  ReceiptText,
  Stethoscope,
  Users,
} from "lucide-react";
import type { AppointmentStatus } from "@prisma/client";

import { requireSession } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/services/dashboard.service";
import { APPOINTMENT_STATUS_META } from "@/lib/constants";
import {
  describeAge,
  formatCurrency,
  formatDate,
  formatDateLong,
  formatNumber,
  formatTime,
} from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  AppointmentStatusBadge,
  AppointmentTypeBadge,
  Avatar,
} from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { buttonClasses } from "@/components/ui/button";
import {
  RankingBars,
  RevenueTrendChart,
  StatusSegmentedBar,
  VisitsBarChart,
} from "@/components/ui/charts";
import { AppointmentStatusActions } from "@/components/appointments/status-actions";

export const metadata: Metadata = { title: "Dashboard" };

// Figures must reflect what was just saved, so this page is never cached.
export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED: "var(--queue-scheduled)",
  CHECKED_IN: "var(--queue-checked-in)",
  IN_CONSULTATION: "var(--queue-in-consultation)",
  COMPLETED: "var(--queue-completed)",
  CANCELLED: "var(--queue-cancelled)",
  NO_SHOW: "var(--queue-no-show)",
};

export default async function DashboardPage() {
  const session = await requireSession();

  // A doctor sees their own clinic; admin and reception see the whole day.
  const scope =
    session.role === "DOCTOR" && session.doctorId
      ? { doctorId: session.doctorId }
      : {};

  const data = await getDashboardData(scope);
  const { kpi } = data;

  const firstName = session.name.split(" ")[0];
  const canBill = session.role === "ADMIN" || session.role === "RECEPTIONIST";

  return (
    <>
      <PageHeader
        title={`Good ${partOfDay()}, ${firstName}`}
        description={formatDateLong(data.generatedAt)}
        actions={
          <>
            <Link
              href="/patients/new"
              className={buttonClasses("secondary", "md")}
            >
              <Users className="h-4 w-4" aria-hidden />
              Register patient
            </Link>
            <Link
              href="/appointments/new"
              className={buttonClasses("primary", "md")}
            >
              <CalendarCheck2 className="h-4 w-4" aria-hidden />
              Book visit
            </Link>
          </>
        }
      />

      {/* ---------------- KPI row ---------------- */}
      <section
        aria-label="Key figures"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Appointments today"
          value={formatNumber(kpi.appointmentsToday)}
          sublabel={`${kpi.completedToday} completed · ${kpi.waitingNow} waiting`}
          icon={<CalendarClock className="h-4 w-4" aria-hidden />}
          href="/appointments"
          accent="sky"
        />
        <StatCard
          label="Consultations today"
          value={formatNumber(kpi.consultationsToday)}
          sublabel={`${kpi.consultationsThisMonth} this month`}
          icon={<Stethoscope className="h-4 w-4" aria-hidden />}
          href="/consultations"
        />
        <StatCard
          label="Collected today"
          value={formatCurrency(kpi.revenueToday)}
          change={kpi.revenueChange}
          changeLabel={`${formatCurrency(kpi.revenueThisMonth)} this month`}
          sublabel={
            kpi.revenueChange === null
              ? `${kpi.paymentsTodayCount} payment${kpi.paymentsTodayCount === 1 ? "" : "s"} recorded`
              : `vs last month · ${formatCurrency(kpi.revenueThisMonth)} MTD`
          }
          icon={<Wallet className="h-4 w-4" aria-hidden />}
          href={canBill ? "/invoices" : undefined}
        />
        <StatCard
          label="Outstanding dues"
          value={formatCurrency(kpi.outstandingTotal)}
          sublabel={`${kpi.outstandingInvoices} unsettled invoice${kpi.outstandingInvoices === 1 ? "" : "s"}`}
          icon={<ReceiptText className="h-4 w-4" aria-hidden />}
          href={canBill ? "/invoices?status=UNPAID" : undefined}
          accent={kpi.outstandingTotal > 0 ? "amber" : "brand"}
        />
      </section>

      {/* ---------------- charts ---------------- */}
      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Payments collected"
            description="Last 14 days, from recorded payments"
            icon={<Activity className="h-4 w-4" aria-hidden />}
            action={
              <span className="tabular text-sm font-semibold text-ink">
                {formatCurrency(
                  data.trend.reduce((sum, day) => sum + day.revenue, 0),
                )}
              </span>
            }
          />
          <CardBody>
            <RevenueTrendChart data={data.trend} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Today's queue status"
            description={`${kpi.appointmentsToday} booked`}
            icon={<Clock3 className="h-4 w-4" aria-hidden />}
          />
          <CardBody>
            <StatusSegmentedBar
              slices={data.statusBreakdown.map((slice) => ({
                label:
                  APPOINTMENT_STATUS_META[slice.status as AppointmentStatus]
                    .label,
                value: slice.count,
                color: STATUS_COLORS[slice.status as AppointmentStatus],
              }))}
            />
          </CardBody>
        </Card>
      </section>

      {/* ---------------- today's queue ---------------- */}
      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Today's schedule"
            description={
              session.role === "DOCTOR"
                ? "Your clinic for today"
                : "Every booking across the clinic"
            }
            icon={<CalendarClock className="h-4 w-4" aria-hidden />}
            action={
              <Link
                href="/appointments"
                className="text-sm font-medium text-brand-ink hover:underline"
              >
                View all
              </Link>
            }
          />

          {data.todaysAppointments.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-5 w-5" aria-hidden />}
              title="Nothing booked for today"
              description="When the front desk books a visit it appears here, ready to check in."
              action={
                <Link
                  href="/appointments/new"
                  className={buttonClasses("primary", "md")}
                >
                  Book the first visit
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {data.todaysAppointments.map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="w-16 shrink-0">
                      <p className="tabular text-sm font-semibold text-ink">
                        {formatTime(appointment.scheduledAt)}
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        {appointment.code.slice(-4)}
                      </p>
                    </div>

                    <Avatar
                      name={`${appointment.patient.firstName} ${appointment.patient.lastName}`}
                      size="sm"
                    />

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/appointments/${appointment.id}`}
                        className="block truncate text-sm font-medium text-ink hover:text-brand-ink hover:underline"
                      >
                        {appointment.patient.firstName}{" "}
                        {appointment.patient.lastName}
                      </Link>
                      <p className="truncate text-xs text-ink-muted">
                        {appointment.patient.mrn} ·{" "}
                        {describeAge(appointment.patient.dateOfBirth)} ·{" "}
                        {appointment.doctor.user.name}
                        {appointment.doctor.roomNumber
                          ? ` · Room ${appointment.doctor.roomNumber}`
                          : ""}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs text-ink-secondary">
                        {appointment.reason}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <AppointmentStatusBadge status={appointment.status} />
                        <AppointmentTypeBadge type={appointment.type} />
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 sm:text-right">
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
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          {/* ---- ready to bill ---- */}
          {canBill ? (
            <Card>
              <CardHeader
                title="Ready to bill"
                description="Completed visits with no invoice yet"
                icon={<ReceiptText className="h-4 w-4" aria-hidden />}
              />
              {data.unbilledVisits.length === 0 ? (
                <EmptyState
                  title="Everything is billed"
                  description="Each completed consultation already has an invoice."
                  className="py-10"
                />
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {data.unbilledVisits.map((visit) => (
                    <li key={visit.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {visit.patient.firstName} {visit.patient.lastName}
                          </p>
                          <p className="truncate text-xs text-ink-muted">
                            {visit.patient.mrn} · {formatDate(visit.createdAt)}
                          </p>
                        </div>
                        <Link
                          href={`/invoices/new?consultationId=${visit.id}`}
                          className={buttonClasses("secondary", "sm")}
                        >
                          Bill
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {/* ---- follow-ups ---- */}
          <Card>
            <CardHeader
              title="Follow-ups due"
              description="Next 14 days"
              icon={<ClipboardList className="h-4 w-4" aria-hidden />}
            />
            {data.upcomingFollowUps.length === 0 ? (
              <EmptyState
                title="No follow-ups scheduled"
                description="Follow-up dates set during a consultation show up here."
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {data.upcomingFollowUps.map((item) => (
                  <li key={item.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/patients/${item.patient.id}`}
                          className="block truncate text-sm font-medium text-ink hover:text-brand-ink hover:underline"
                        >
                          {item.patient.firstName} {item.patient.lastName}
                        </Link>
                        <p className="truncate text-xs text-ink-muted">
                          {item.diagnosis}
                        </p>
                      </div>
                      <span className="tabular shrink-0 text-xs font-medium text-ink-secondary">
                        {formatDate(item.followUpDate)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      {/* ---------------- secondary charts ---------------- */}
      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Visits per day"
            description="Last 14 days, by outcome"
            icon={<CalendarCheck2 className="h-4 w-4" aria-hidden />}
          />
          <CardBody>
            <VisitsBarChart data={data.trend} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Busiest doctors"
            description="Consultations this month"
            icon={<Stethoscope className="h-4 w-4" aria-hidden />}
          />
          <CardBody>
            {data.topDoctors.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">
                No consultations recorded this month yet.
              </p>
            ) : (
              <RankingBars
                items={data.topDoctors.map((doctor) => ({
                  label: doctor.name,
                  sublabel: doctor.specialization,
                  value: doctor.visits,
                }))}
              />
            )}
          </CardBody>
        </Card>
      </section>

      <p className="mt-6 text-center text-xs text-ink-muted">
        Every figure on this page is aggregated from stored records at page
        load — nothing here is hard-coded.
      </p>
    </>
  );
}

function partOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
