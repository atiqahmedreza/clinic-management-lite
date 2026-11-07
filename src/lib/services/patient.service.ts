import "server-only";

import type { Gender, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { BusinessRuleError, NotFoundError } from "@/lib/errors";
import { PAGE_SIZE } from "@/lib/constants";
import { serialize } from "@/lib/serialize";
import { nextMrn, withCodeRetry } from "@/lib/services/codes";
import type {
  PatientInput,
  UpdatePatientInput,
} from "@/lib/validations/patient";

export type PatientListFilters = {
  search?: string;
  gender?: Gender;
  status?: "active" | "inactive" | "all";
  page?: number;
  pageSize?: number;
};

/**
 * Paginated patient directory with a single free-text search box that matches
 * name, MRN, phone or email, plus gender and active/inactive filters.
 */
export async function listPatients(filters: PatientListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const search = filters.search?.trim();

  const where: Prisma.PatientWhereInput = {};

  if (filters.status === "active") where.isActive = true;
  if (filters.status === "inactive") where.isActive = false;
  if (filters.gender) where.gender = filters.gender;

  if (search) {
    const terms = search.split(/\s+/).filter(Boolean);
    where.AND = terms.map((term) => ({
      OR: [
        { firstName: { contains: term, mode: "insensitive" as const } },
        { lastName: { contains: term, mode: "insensitive" as const } },
        { mrn: { contains: term, mode: "insensitive" as const } },
        { phone: { contains: term.replace(/\D/g, "") || term } },
        { email: { contains: term, mode: "insensitive" as const } },
      ],
    }));
  }

  const [rows, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        mrn: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        phone: true,
        city: true,
        bloodGroup: true,
        isActive: true,
        createdAt: true,
        _count: { select: { appointments: true, consultations: true } },
      },
    }),
    prisma.patient.count({ where }),
  ]);

  return {
    rows: serialize(rows),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Lightweight list used by the appointment booking combobox. */
export async function searchPatientsForPicker(search: string, limit = 8) {
  const term = search.trim();
  if (!term) {
    const recent = await prisma.patient.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: pickerSelect,
    });
    return serialize(recent);
  }

  const rows = await prisma.patient.findMany({
    where: {
      isActive: true,
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { mrn: { contains: term, mode: "insensitive" } },
        { phone: { contains: term.replace(/\D/g, "") || term } },
      ],
    },
    orderBy: { firstName: "asc" },
    take: limit,
    select: pickerSelect,
  });
  return serialize(rows);
}

const pickerSelect = {
  id: true,
  mrn: true,
  firstName: true,
  lastName: true,
  phone: true,
  dateOfBirth: true,
  gender: true,
} satisfies Prisma.PatientSelect;

export type PatientPickerOption = Awaited<
  ReturnType<typeof searchPatientsForPicker>
>[number];

/** Full patient record with the complete visit history. */
export async function getPatientProfile(id: string) {
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      appointments: {
        orderBy: { scheduledAt: "desc" },
        include: {
          doctor: { select: { id: true, specialization: true, user: { select: { name: true } } } },
          consultation: { select: { id: true, diagnosis: true } },
        },
      },
      consultations: {
        orderBy: { createdAt: "desc" },
        include: {
          doctor: { select: { specialization: true, user: { select: { name: true } } } },
          prescriptions: true,
          invoice: { select: { id: true, number: true, status: true, totalAmount: true } },
          appointment: { select: { code: true, scheduledAt: true, type: true } },
        },
      },
      invoices: {
        orderBy: { issuedAt: "desc" },
        select: {
          id: true,
          number: true,
          issuedAt: true,
          totalAmount: true,
          paidAmount: true,
          status: true,
        },
      },
    },
  });

  if (!patient) throw new NotFoundError("Patient");

  const totals = patient.invoices.reduce(
    (acc, invoice) => {
      if (invoice.status === "CANCELLED") return acc;
      acc.billed += invoice.totalAmount.toNumber();
      acc.paid += invoice.paidAmount.toNumber();
      return acc;
    },
    { billed: 0, paid: 0 },
  );

  return serialize({
    ...patient,
    summary: {
      totalVisits: patient.consultations.length,
      totalAppointments: patient.appointments.length,
      totalBilled: totals.billed,
      totalPaid: totals.paid,
      outstanding: Math.max(0, totals.billed - totals.paid),
      lastVisitAt: patient.consultations[0]?.createdAt ?? null,
    },
  });
}

export type PatientProfile = Awaited<ReturnType<typeof getPatientProfile>>;

export async function getPatientForEdit(id: string) {
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) throw new NotFoundError("Patient");
  return serialize(patient);
}

export async function createPatient(input: PatientInput, createdById: string) {
  await assertPhoneIsFree(input.phone);

  return withCodeRetry(async () =>
    prisma.$transaction(async (tx) => {
      const mrn = await nextMrn(tx);
      const patient = await tx.patient.create({
        data: { ...input, mrn, createdById },
        select: { id: true, mrn: true, firstName: true, lastName: true },
      });
      return patient;
    }),
  );
}

export async function updatePatient(input: UpdatePatientInput) {
  const { id, ...data } = input;

  const existing = await prisma.patient.findUnique({
    where: { id },
    select: { id: true, phone: true },
  });
  if (!existing) throw new NotFoundError("Patient");

  if (data.phone !== existing.phone) {
    await assertPhoneIsFree(data.phone, id);
  }

  // A patient with upcoming appointments must not be deactivated, otherwise
  // the diary would hold visits nobody can check in.
  if (!data.isActive) {
    const upcoming = await prisma.appointment.count({
      where: {
        patientId: id,
        status: { in: ["SCHEDULED", "CHECKED_IN", "IN_CONSULTATION"] },
      },
    });
    if (upcoming > 0) {
      throw new BusinessRuleError(
        `This patient still has ${upcoming} open appointment${upcoming === 1 ? "" : "s"}. Cancel or complete them before archiving the record.`,
      );
    }
  }

  return prisma.patient.update({
    where: { id },
    data,
    select: { id: true, mrn: true, firstName: true, lastName: true },
  });
}

async function assertPhoneIsFree(phone: string, exceptId?: string) {
  const duplicate = await prisma.patient.findFirst({
    where: { phone, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true, mrn: true, firstName: true, lastName: true },
  });
  if (duplicate) {
    throw new BusinessRuleError(
      `${duplicate.firstName} ${duplicate.lastName} (${duplicate.mrn}) is already registered with this phone number.`,
      { phone: ["This phone number is already registered."] },
    );
  }
}

/** Single patient in the shape the booking combobox expects. */
export async function getPatientPickerOption(
  id: string,
): Promise<PatientPickerOption | null> {
  const patient = await prisma.patient.findUnique({
    where: { id },
    select: pickerSelect,
  });
  return patient ? serialize(patient) : null;
}
