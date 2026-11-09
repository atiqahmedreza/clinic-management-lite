import "server-only";

import { prisma } from "@/lib/db";
import { round2, toNumber } from "@/lib/serialize";
import { serialize } from "@/lib/serialize";
import { addDays, endOfDay, startOfDay } from "@/lib/utils";

/**
 * Every figure on the dashboard is aggregated from stored rows at request
 * time. Nothing here is hard-coded or cached.
 */

function startOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return round2(((current - previous) / previous) * 100);
}

export async function getDashboardData(options: { doctorId?: string } = {}) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const prevMonthStart = startOfMonth(addDays(monthStart, -1));
  const prevMonthEnd = endOfDay(addDays(monthStart, -1));

  const doctorScope = options.doctorId ? { doctorId: options.doctorId } : {};

  const [
    todaysAppointments,
    statusCounts,
    activePatients,
    newPatientsThisMonth,
    newPatientsPrevMonth,
    consultationsToday,
    consultationsThisMonth,
    paymentsToday,
    paymentsThisMonth,
    paymentsPrevMonth,
    outstanding,
    upcomingFollowUps,
    unbilledVisits,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: todayStart, lte: todayEnd },
        ...doctorScope,
      },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        code: true,
        scheduledAt: true,
        status: true,
        type: true,
        reason: true,
        patient: {
          select: {
            id: true,
            mrn: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
          },
        },
        doctor: {
          select: {
            id: true,
            roomNumber: true,
            specialization: true,
            user: { select: { name: true } },
          },
        },
        consultation: { select: { id: true } },
      },
    }),

    prisma.appointment.groupBy({
      by: ["status"],
      where: { scheduledAt: { gte: todayStart, lte: todayEnd }, ...doctorScope },
      _count: { _all: true },
    }),

    prisma.patient.count({ where: { isActive: true } }),
    prisma.patient.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.patient.count({
      where: { createdAt: { gte: prevMonthStart, lte: prevMonthEnd } },
    }),

    prisma.consultation.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd }, ...doctorScope },
    }),
    prisma.consultation.count({
      where: { createdAt: { gte: monthStart }, ...doctorScope },
    }),

    prisma.payment.aggregate({
      where: { paidAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: prevMonthStart, lte: prevMonthEnd } },
      _sum: { amount: true },
    }),

    prisma.invoice.aggregate({
      where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: { _all: true },
    }),

    prisma.consultation.findMany({
      where: {
        followUpDate: { gte: todayStart, lte: endOfDay(addDays(now, 14)) },
        ...doctorScope,
      },
      orderBy: { followUpDate: "asc" },
      take: 6,
      select: {
        id: true,
        followUpDate: true,
        diagnosis: true,
        patient: {
          select: { id: true, mrn: true, firstName: true, lastName: true, phone: true },
        },
        doctor: { select: { user: { select: { name: true } } } },
      },
    }),

    prisma.consultation.findMany({
      where: { invoice: null, appointment: { status: "COMPLETED" }, ...doctorScope },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        createdAt: true,
        diagnosis: true,
        patient: {
          select: { id: true, mrn: true, firstName: true, lastName: true },
        },
        doctor: { select: { user: { select: { name: true } } } },
      },
    }),
  ]);

  // ---- derive --------------------------------------------------------------

  const statusMap = Object.fromEntries(
    statusCounts.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;

  const revenueToday = toNumber(paymentsToday._sum.amount);
  const revenueThisMonth = toNumber(paymentsThisMonth._sum.amount);
  const revenuePrevMonth = toNumber(paymentsPrevMonth._sum.amount);

  const outstandingTotal = round2(
    toNumber(outstanding._sum.totalAmount) - toNumber(outstanding._sum.paidAmount),
  );

  const waiting = todaysAppointments.filter(
    (item) => item.status === "CHECKED_IN",
  );
  const inConsultation = todaysAppointments.filter(
    (item) => item.status === "IN_CONSULTATION",
  );

  return serialize({
    generatedAt: now,
    kpi: {
      appointmentsToday: todaysAppointments.length,
      completedToday: statusMap.COMPLETED ?? 0,
      waitingNow: waiting.length,
      inConsultationNow: inConsultation.length,
      activePatients,
      newPatientsThisMonth,
      newPatientsChange: percentChange(
        newPatientsThisMonth,
        newPatientsPrevMonth,
      ),
      consultationsToday,
      consultationsThisMonth,
      revenueToday,
      paymentsTodayCount: paymentsToday._count._all,
      revenueThisMonth,
      revenueChange: percentChange(revenueThisMonth, revenuePrevMonth),
      outstandingTotal,
      outstandingInvoices: outstanding._count._all,
    },
    todaysAppointments,
    upcomingFollowUps,
    unbilledVisits,
  });
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
