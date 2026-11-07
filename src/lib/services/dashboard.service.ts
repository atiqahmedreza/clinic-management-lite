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
  const trendStart = startOfDay(addDays(now, -13));

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
    recentPayments,
    recentAppointments,
    upcomingFollowUps,
    topDoctors,
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

    prisma.payment.findMany({
      where: { paidAt: { gte: trendStart } },
      select: { paidAt: true, amount: true },
    }),

    prisma.appointment.findMany({
      where: { scheduledAt: { gte: trendStart, lte: todayEnd }, ...doctorScope },
      select: { scheduledAt: true, status: true },
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

    prisma.consultation.groupBy({
      by: ["doctorId"],
      where: { createdAt: { gte: monthStart } },
      _count: { _all: true },
      orderBy: { _count: { doctorId: "desc" } },
      take: 5,
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

  const doctorNames = topDoctors.length
    ? await prisma.doctor.findMany({
        where: { id: { in: topDoctors.map((row) => row.doctorId) } },
        select: {
          id: true,
          specialization: true,
          user: { select: { name: true } },
        },
      })
    : [];
  const doctorById = new Map(doctorNames.map((d) => [d.id, d]));

  // 14-day trend buckets
  const days: {
    date: Date;
    key: string;
    label: string;
    revenue: number;
    appointments: number;
    completed: number;
  }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const date = startOfDay(addDays(now, -i));
    days.push({
      date,
      key: dayKey(date),
      label: date.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
      revenue: 0,
      appointments: 0,
      completed: 0,
    });
  }
  const byKey = new Map(days.map((day) => [day.key, day]));

  for (const payment of recentPayments) {
    const bucket = byKey.get(dayKey(payment.paidAt));
    if (bucket) bucket.revenue = round2(bucket.revenue + toNumber(payment.amount));
  }
  for (const appointment of recentAppointments) {
    const bucket = byKey.get(dayKey(appointment.scheduledAt));
    if (!bucket) continue;
    bucket.appointments += 1;
    if (appointment.status === "COMPLETED") bucket.completed += 1;
  }

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
    statusBreakdown: [
      { status: "SCHEDULED", count: statusMap.SCHEDULED ?? 0 },
      { status: "CHECKED_IN", count: statusMap.CHECKED_IN ?? 0 },
      { status: "IN_CONSULTATION", count: statusMap.IN_CONSULTATION ?? 0 },
      { status: "COMPLETED", count: statusMap.COMPLETED ?? 0 },
      { status: "CANCELLED", count: statusMap.CANCELLED ?? 0 },
      { status: "NO_SHOW", count: statusMap.NO_SHOW ?? 0 },
    ],
    trend: days.map(({ key: _key, date: _date, ...rest }) => rest),
    todaysAppointments,
    upcomingFollowUps,
    unbilledVisits,
    topDoctors: topDoctors.map((row) => ({
      doctorId: row.doctorId,
      name: doctorById.get(row.doctorId)?.user.name ?? "Unknown",
      specialization: doctorById.get(row.doctorId)?.specialization ?? "",
      visits: row._count._all,
    })),
  });
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
