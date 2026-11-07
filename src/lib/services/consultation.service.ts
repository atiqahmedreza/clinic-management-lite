import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "@/lib/errors";
import { PAGE_SIZE } from "@/lib/constants";
import { serialize } from "@/lib/serialize";
import type { SessionPayload } from "@/lib/auth/jwt";
import type { ConsultationInput } from "@/lib/validations/consultation";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type ConsultationFilters = {
  search?: string;
  doctorId?: string;
  patientId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export async function listConsultations(filters: ConsultationFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? PAGE_SIZE;

  const where: Prisma.ConsultationWhereInput = {};
  if (filters.doctorId) where.doctorId = filters.doctorId;
  if (filters.patientId) where.patientId = filters.patientId;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { diagnosis: { contains: search, mode: "insensitive" } },
      { symptoms: { contains: search, mode: "insensitive" } },
      { patient: { firstName: { contains: search, mode: "insensitive" } } },
      { patient: { lastName: { contains: search, mode: "insensitive" } } },
      { patient: { mrn: { contains: search, mode: "insensitive" } } },
      { appointment: { code: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.consultation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
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
            specialization: true,
            user: { select: { name: true } },
          },
        },
        appointment: { select: { code: true, scheduledAt: true, type: true } },
        invoice: { select: { id: true, number: true, status: true } },
        _count: { select: { prescriptions: true } },
      },
    }),
    prisma.consultation.count({ where }),
  ]);

  return {
    rows: serialize(rows),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type ConsultationRow = Awaited<
  ReturnType<typeof listConsultations>
>["rows"][number];

export async function getConsultation(id: string) {
  const consultation = await prisma.consultation.findUnique({
    where: { id },
    include: {
      patient: true,
      doctor: { include: { user: { select: { name: true, email: true } } } },
      appointment: true,
      prescriptions: { orderBy: { createdAt: "asc" } },
      invoice: {
        include: { items: true, payments: true },
      },
    },
  });
  if (!consultation) throw new NotFoundError("Consultation");
  return serialize(consultation);
}

export type ConsultationDetail = Awaited<ReturnType<typeof getConsultation>>;

/** Previous visits for the same patient, shown beside the consultation form. */
export async function getPatientHistoryForConsultation(
  patientId: string,
  excludeConsultationId?: string,
  limit = 5,
) {
  const rows = await prisma.consultation.findMany({
    where: {
      patientId,
      ...(excludeConsultationId ? { id: { not: excludeConsultationId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      diagnosis: true,
      symptoms: true,
      followUpDate: true,
      doctor: { select: { user: { select: { name: true } } } },
      prescriptions: { select: { medicineName: true, dosage: true } },
    },
  });
  return serialize(rows);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Called when the doctor opens the consultation form from the queue. */
export async function startConsultation(
  appointmentId: string,
  session: SessionPayload,
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, status: true, doctorId: true },
  });
  if (!appointment) throw new NotFoundError("Appointment");

  assertDoctorOwnsVisit(session, appointment.doctorId);

  if (appointment.status === "IN_CONSULTATION") return { id: appointment.id };

  if (appointment.status !== "CHECKED_IN") {
    throw new BusinessRuleError(
      "The patient must be checked in at the front desk before the consultation can start.",
    );
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "IN_CONSULTATION", startedAt: new Date() },
  });

  return { id: appointment.id };
}

/**
 * Saves the clinical record for a visit and closes the appointment.
 *
 * The consultation, its prescriptions and the appointment status all change
 * together inside one transaction, so a half-written record can never exist.
 */
export async function saveConsultation(
  input: ConsultationInput,
  session: SessionPayload,
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    select: {
      id: true,
      status: true,
      doctorId: true,
      patientId: true,
      consultation: { select: { id: true } },
    },
  });
  if (!appointment) throw new NotFoundError("Appointment");

  assertDoctorOwnsVisit(session, appointment.doctorId);

  if (!["CHECKED_IN", "IN_CONSULTATION"].includes(appointment.status)) {
    throw new BusinessRuleError(
      appointment.status === "COMPLETED"
        ? "This visit is already completed. Open the consultation record to review it."
        : "Only a checked-in patient can have a consultation recorded.",
    );
  }

  const { appointmentId, prescriptions, ...clinical } = input;

  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultation.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        ...clinical,
      },
      update: clinical,
      select: { id: true },
    });

    // Prescriptions are replaced wholesale - simpler and safer than diffing,
    // and the list is always short.
    await tx.prescription.deleteMany({
      where: { consultationId: consultation.id },
    });
    if (prescriptions.length > 0) {
      await tx.prescription.createMany({
        data: prescriptions.map((item) => ({
          ...item,
          consultationId: consultation.id,
        })),
      });
    }

    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "COMPLETED",
        startedAt: appointment.status === "CHECKED_IN" ? new Date() : undefined,
        completedAt: new Date(),
      },
    });

    return consultation;
  });
}

function assertDoctorOwnsVisit(session: SessionPayload, doctorId: string) {
  if (session.role === "ADMIN") return;
  if (session.role !== "DOCTOR") {
    throw new AuthorizationError(
      "Only the attending doctor can record a consultation.",
    );
  }
  if (session.doctorId !== doctorId) {
    throw new AuthorizationError(
      "This visit is assigned to another doctor.",
    );
  }
}
