import "server-only";

import type { AppointmentStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { BusinessRuleError, NotFoundError } from "@/lib/errors";
import {
  ALLOWED_STATUS_TRANSITIONS,
  APPOINTMENT_STATUS_META,
  BLOCKING_STATUSES,
  PAGE_SIZE,
} from "@/lib/constants";
import { serialize } from "@/lib/serialize";
import {
  endOfDay,
  formatClockTime,
  formatDateTime,
  isoWeekday,
  minutesToTime,
  startOfDay,
  timeToMinutes,
} from "@/lib/utils";
import { nextAppointmentCode, withCodeRetry } from "@/lib/services/codes";
import type {
  CreateAppointmentInput,
  RescheduleAppointmentInput,
} from "@/lib/validations/appointment";

const MAX_SLOT_MINUTES = 180;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type AppointmentFilters = {
  search?: string;
  status?: AppointmentStatus;
  doctorId?: string;
  patientId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export async function listAppointments(filters: AppointmentFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? PAGE_SIZE;

  const where = buildAppointmentWhere(filters);

  const [rows, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: { scheduledAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: appointmentListInclude,
    }),
    prisma.appointment.count({ where }),
  ]);

  return {
    rows: serialize(rows),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

const appointmentListInclude = {
  patient: {
    select: {
      id: true,
      mrn: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      gender: true,
    },
  },
  doctor: {
    select: {
      id: true,
      specialization: true,
      roomNumber: true,
      user: { select: { name: true } },
    },
  },
  consultation: { select: { id: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentRow = Awaited<
  ReturnType<typeof listAppointments>
>["rows"][number];

function buildAppointmentWhere(
  filters: AppointmentFilters,
): Prisma.AppointmentWhereInput {
  const where: Prisma.AppointmentWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.doctorId) where.doctorId = filters.doctorId;
  if (filters.patientId) where.patientId = filters.patientId;

  if (filters.from || filters.to) {
    where.scheduledAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { reason: { contains: search, mode: "insensitive" } },
      { patient: { firstName: { contains: search, mode: "insensitive" } } },
      { patient: { lastName: { contains: search, mode: "insensitive" } } },
      { patient: { mrn: { contains: search, mode: "insensitive" } } },
      { patient: { phone: { contains: search.replace(/\D/g, "") || search } } },
      {
        doctor: {
          user: { name: { contains: search, mode: "insensitive" } },
        },
      },
    ];
  }

  return where;
}

export async function getAppointment(id: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      createdBy: { select: { name: true } },
      consultation: {
        include: {
          prescriptions: true,
          invoice: {
            select: {
              id: true,
              number: true,
              status: true,
              totalAmount: true,
              paidAmount: true,
            },
          },
        },
      },
    },
  });

  if (!appointment) throw new NotFoundError("Appointment");

  return serialize({
    ...appointment,
    allowedTransitions: ALLOWED_STATUS_TRANSITIONS[appointment.status],
  });
}

export type AppointmentDetail = Awaited<ReturnType<typeof getAppointment>>;

/** Today's live queue, used by the dashboard and the front desk. */
export async function getTodayQueue(doctorId?: string) {
  const now = new Date();
  const rows = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: startOfDay(now), lte: endOfDay(now) },
      ...(doctorId ? { doctorId } : {}),
    },
    orderBy: { scheduledAt: "asc" },
    include: appointmentListInclude,
  });
  return serialize(rows);
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export type SlotSuggestion = {
  /** "HH:mm" in clinic-local time. */
  time: string;
  label: string;
  available: boolean;
  reason?: string;
};

/**
 * Every slot in the doctor's working window for a given day, flagged with
 * whether it is still free. Powers the time picker in the booking form so the
 * receptionist sees conflicts before submitting.
 */
export async function getDoctorDaySlots(
  doctorId: string,
  day: Date,
  durationMinutes = 30,
  excludeAppointmentId?: string,
): Promise<{
  slots: SlotSuggestion[];
  working: boolean;
  note?: string;
}> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      availableDays: true,
      startTime: true,
      endTime: true,
      slotMinutes: true,
      isAcceptingPatients: true,
      user: { select: { name: true, isActive: true } },
    },
  });

  if (!doctor) throw new NotFoundError("Doctor");

  if (!doctor.isAcceptingPatients || !doctor.user.isActive) {
    return {
      slots: [],
      working: false,
      note: `${doctor.user.name} is not accepting new bookings at the moment.`,
    };
  }

  if (!doctor.availableDays.includes(isoWeekday(day))) {
    return {
      slots: [],
      working: false,
      note: `${doctor.user.name} does not hold clinic on this day.`,
    };
  }

  const existing = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { in: BLOCKING_STATUSES },
      scheduledAt: { gte: startOfDay(day), lte: endOfDay(day) },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: { scheduledAt: true, durationMinutes: true },
  });

  const booked = existing.map((item) => {
    const start =
      item.scheduledAt.getHours() * 60 + item.scheduledAt.getMinutes();
    return { start, end: start + item.durationMinutes };
  });

  const open = timeToMinutes(doctor.startTime);
  const close = timeToMinutes(doctor.endTime);
  const step = doctor.slotMinutes;
  const now = new Date();
  const isToday = startOfDay(day).getTime() === startOfDay(now).getTime();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const slots: SlotSuggestion[] = [];
  for (let start = open; start + durationMinutes <= close; start += step) {
    const end = start + durationMinutes;
    const clash = booked.some((item) => start < item.end && end > item.start);
    const past = isToday && start < nowMinutes;

    slots.push({
      time: minutesToTime(start),
      label: formatClockTime(minutesToTime(start)),
      available: !clash && !past,
      reason: past ? "Time has passed" : clash ? "Already booked" : undefined,
    });
  }

  return { slots, working: true };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createAppointment(
  input: CreateAppointmentInput,
  createdById: string,
) {
  const [patient, doctor] = await Promise.all([
    prisma.patient.findUnique({
      where: { id: input.patientId },
      select: { id: true, isActive: true, firstName: true, lastName: true },
    }),
    loadDoctorForBooking(input.doctorId),
  ]);

  if (!patient) throw new NotFoundError("Patient");
  if (!patient.isActive) {
    throw new BusinessRuleError(
      `${patient.firstName} ${patient.lastName}'s record is archived. Reactivate the patient before booking a visit.`,
    );
  }

  assertWithinWorkingHours(doctor, input.scheduledAt, input.durationMinutes);
  await assertDoctorIsFree(input.doctorId, input.scheduledAt, input.durationMinutes);
  await assertPatientIsFree(input.patientId, input.scheduledAt, input.durationMinutes);

  return withCodeRetry(async () =>
    prisma.$transaction(async (tx) => {
      const code = await nextAppointmentCode(tx, input.scheduledAt);
      return tx.appointment.create({
        data: { ...input, code, createdById },
        select: { id: true, code: true, scheduledAt: true },
      });
    }),
  );
}

export async function rescheduleAppointment(
  input: RescheduleAppointmentInput,
) {
  const existing = await prisma.appointment.findUnique({
    where: { id: input.id },
    select: { id: true, status: true, patientId: true },
  });
  if (!existing) throw new NotFoundError("Appointment");

  if (!["SCHEDULED", "CHECKED_IN"].includes(existing.status)) {
    throw new BusinessRuleError(
      `A visit that is ${APPOINTMENT_STATUS_META[existing.status].label.toLowerCase()} can no longer be rescheduled.`,
    );
  }

  const doctor = await loadDoctorForBooking(input.doctorId);
  assertWithinWorkingHours(doctor, input.scheduledAt, input.durationMinutes);
  await assertDoctorIsFree(
    input.doctorId,
    input.scheduledAt,
    input.durationMinutes,
    input.id,
  );
  await assertPatientIsFree(
    existing.patientId,
    input.scheduledAt,
    input.durationMinutes,
    input.id,
  );

  return prisma.appointment.update({
    where: { id: input.id },
    data: {
      doctorId: input.doctorId,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      reason: input.reason,
      type: input.type,
      notes: input.notes,
    },
    select: { id: true, code: true },
  });
}

/**
 * Moves an appointment along its lifecycle. Every transition is checked
 * against `ALLOWED_STATUS_TRANSITIONS`, so the UI can never push a visit into
 * an impossible state.
 */
export async function changeAppointmentStatus(
  id: string,
  next: AppointmentStatus,
  options: { cancellationReason?: string } = {},
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, status: true, scheduledAt: true },
  });
  if (!appointment) throw new NotFoundError("Appointment");

  assertTransitionAllowed(appointment.status, next);

  if (next === "CANCELLED" && !options.cancellationReason) {
    throw new BusinessRuleError("A cancellation reason is required.");
  }

  if (next === "CHECKED_IN") {
    // Guard against checking in a visit that is more than a day old - that is
    // almost always a mis-click on yesterday's list.
    const ageHours =
      (Date.now() - appointment.scheduledAt.getTime()) / (1000 * 60 * 60);
    if (ageHours > 24) {
      throw new BusinessRuleError(
        `This visit was scheduled for ${formatDateTime(appointment.scheduledAt)}. Reschedule it before checking the patient in.`,
      );
    }
  }

  const now = new Date();
  const data: Prisma.AppointmentUpdateInput = { status: next };
  if (next === "CHECKED_IN") data.checkedInAt = now;
  if (next === "IN_CONSULTATION") data.startedAt = now;
  if (next === "COMPLETED") data.completedAt = now;
  if (next === "CANCELLED") {
    data.cancelledAt = now;
    data.cancellationReason = options.cancellationReason;
  }

  return prisma.appointment.update({
    where: { id },
    data,
    select: { id: true, status: true, code: true },
  });
}

export function assertTransitionAllowed(
  current: AppointmentStatus,
  next: AppointmentStatus,
) {
  if (current === next) {
    throw new BusinessRuleError(
      `This visit is already marked as ${APPOINTMENT_STATUS_META[next].label.toLowerCase()}.`,
    );
  }
  if (!ALLOWED_STATUS_TRANSITIONS[current].includes(next)) {
    throw new BusinessRuleError(
      `A visit that is ${APPOINTMENT_STATUS_META[current].label.toLowerCase()} cannot be moved to ${APPOINTMENT_STATUS_META[next].label.toLowerCase()}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Booking rules
// ---------------------------------------------------------------------------

type BookableDoctor = {
  id: string;
  availableDays: number[];
  startTime: string;
  endTime: string;
  isAcceptingPatients: boolean;
  user: { name: string; isActive: boolean };
};

async function loadDoctorForBooking(doctorId: string): Promise<BookableDoctor> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      id: true,
      availableDays: true,
      startTime: true,
      endTime: true,
      isAcceptingPatients: true,
      user: { select: { name: true, isActive: true } },
    },
  });
  if (!doctor) throw new NotFoundError("Doctor");
  if (!doctor.user.isActive) {
    throw new BusinessRuleError(
      `${doctor.user.name}'s account is deactivated and cannot take bookings.`,
    );
  }
  if (!doctor.isAcceptingPatients) {
    throw new BusinessRuleError(
      `${doctor.user.name} is not accepting bookings at the moment.`,
      { doctorId: ["This doctor is not accepting bookings."] },
    );
  }
  return doctor;
}

function assertWithinWorkingHours(
  doctor: BookableDoctor,
  scheduledAt: Date,
  durationMinutes: number,
) {
  const weekday = isoWeekday(scheduledAt);
  if (!doctor.availableDays.includes(weekday)) {
    throw new BusinessRuleError(
      `${doctor.user.name} does not hold clinic on ${scheduledAt.toLocaleDateString("en-US", { weekday: "long" })}.`,
      { scheduledAt: ["The doctor does not work on this day."] },
    );
  }

  const start = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();
  const end = start + durationMinutes;
  const open = timeToMinutes(doctor.startTime);
  const close = timeToMinutes(doctor.endTime);

  if (start < open || end > close) {
    throw new BusinessRuleError(
      `${doctor.user.name} sees patients between ${formatClockTime(doctor.startTime)} and ${formatClockTime(doctor.endTime)}. A ${durationMinutes}-minute visit must finish inside that window.`,
      { scheduledAt: ["Outside the doctor's working hours."] },
    );
  }
}

/** No two active visits may overlap in the same doctor's diary. */
async function assertDoctorIsFree(
  doctorId: string,
  scheduledAt: Date,
  durationMinutes: number,
  excludeId?: string,
) {
  const end = new Date(scheduledAt.getTime() + durationMinutes * 60_000);
  const windowStart = new Date(
    scheduledAt.getTime() - MAX_SLOT_MINUTES * 60_000,
  );

  const candidates = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { in: BLOCKING_STATUSES },
      scheduledAt: { gte: windowStart, lt: end },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      code: true,
      scheduledAt: true,
      durationMinutes: true,
      patient: { select: { firstName: true, lastName: true } },
    },
  });

  const clash = candidates.find(
    (item) =>
      new Date(
        item.scheduledAt.getTime() + item.durationMinutes * 60_000,
      ).getTime() > scheduledAt.getTime(),
  );

  if (clash) {
    const clashEnd = new Date(
      clash.scheduledAt.getTime() + clash.durationMinutes * 60_000,
    );
    throw new BusinessRuleError(
      `That slot overlaps ${clash.code} (${clash.patient.firstName} ${clash.patient.lastName}) from ${formatClockTime(toClock(clash.scheduledAt))} to ${formatClockTime(toClock(clashEnd))}. Pick another time.`,
      { scheduledAt: ["This slot is already booked."] },
    );
  }
}

/** The same patient cannot be in two places at once either. */
async function assertPatientIsFree(
  patientId: string,
  scheduledAt: Date,
  durationMinutes: number,
  excludeId?: string,
) {
  const end = new Date(scheduledAt.getTime() + durationMinutes * 60_000);
  const windowStart = new Date(
    scheduledAt.getTime() - MAX_SLOT_MINUTES * 60_000,
  );

  const candidates = await prisma.appointment.findMany({
    where: {
      patientId,
      status: { in: BLOCKING_STATUSES },
      scheduledAt: { gte: windowStart, lt: end },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      code: true,
      scheduledAt: true,
      durationMinutes: true,
      doctor: { select: { user: { select: { name: true } } } },
    },
  });

  const clash = candidates.find(
    (item) =>
      new Date(
        item.scheduledAt.getTime() + item.durationMinutes * 60_000,
      ).getTime() > scheduledAt.getTime(),
  );

  if (clash) {
    throw new BusinessRuleError(
      `This patient already has visit ${clash.code} with ${clash.doctor.user.name} at ${formatClockTime(toClock(clash.scheduledAt))}.`,
      { scheduledAt: ["The patient already has a visit at this time."] },
    );
  }
}

function toClock(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}
