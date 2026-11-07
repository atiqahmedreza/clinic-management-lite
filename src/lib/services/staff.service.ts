import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { BusinessRuleError, NotFoundError } from "@/lib/errors";
import { serialize } from "@/lib/serialize";
import { hashPassword } from "@/lib/auth/password";
import type {
  CreateStaffInput,
  UpdateStaffInput,
} from "@/lib/validations/staff";

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------

/** Doctors who can currently be booked - used by the appointment form. */
export async function listBookableDoctors() {
  const rows = await prisma.doctor.findMany({
    where: { isAcceptingPatients: true, user: { isActive: true } },
    orderBy: { user: { name: "asc" } },
    select: {
      id: true,
      specialization: true,
      consultationFee: true,
      roomNumber: true,
      availableDays: true,
      startTime: true,
      endTime: true,
      slotMinutes: true,
      user: { select: { id: true, name: true } },
    },
  });
  return serialize(rows);
}

export type BookableDoctorOption = Awaited<
  ReturnType<typeof listBookableDoctors>
>[number];

export async function listDoctors() {
  const rows = await prisma.doctor.findMany({
    orderBy: { user: { name: "asc" } },
    include: {
      user: { select: { id: true, name: true, email: true, isActive: true } },
      _count: { select: { appointments: true, consultations: true } },
    },
  });
  return serialize(rows);
}

export async function getDoctorProfile(id: string) {
  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, isActive: true },
      },
    },
  });
  if (!doctor) throw new NotFoundError("Doctor");

  const [upcoming, completed, consultations] = await Promise.all([
    prisma.appointment.count({
      where: {
        doctorId: id,
        status: { in: ["SCHEDULED", "CHECKED_IN", "IN_CONSULTATION"] },
      },
    }),
    prisma.appointment.count({ where: { doctorId: id, status: "COMPLETED" } }),
    prisma.consultation.findMany({
      where: { doctorId: id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        createdAt: true,
        diagnosis: true,
        patient: {
          select: { id: true, mrn: true, firstName: true, lastName: true },
        },
      },
    }),
  ]);

  return serialize({
    ...doctor,
    stats: { upcoming, completed },
    recentConsultations: consultations,
  });
}

// ---------------------------------------------------------------------------
// Staff accounts
// ---------------------------------------------------------------------------

export async function listStaff(search?: string) {
  const where: Prisma.UserWhereInput = {};
  if (search?.trim()) {
    const term = search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.user.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      doctorProfile: {
        select: { id: true, specialization: true, consultationFee: true },
      },
    },
  });
  return serialize(rows);
}

export type StaffRow = Awaited<ReturnType<typeof listStaff>>[number];

export async function getStaffMember(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { doctorProfile: true },
  });
  if (!user) throw new NotFoundError("Staff member");
  const { passwordHash: _passwordHash, ...safe } = user;
  return serialize(safe);
}

export async function createStaff(input: CreateStaffInput) {
  const { password, doctor, ...user } = input;

  const existing = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });
  if (existing) {
    throw new BusinessRuleError("An account with that email already exists.", {
      email: ["This email is already registered."],
    });
  }

  const passwordHash = await hashPassword(password);

  return prisma.user.create({
    data: {
      ...user,
      passwordHash,
      ...(user.role === "DOCTOR" && doctor
        ? { doctorProfile: { create: doctor } }
        : {}),
    },
    select: { id: true, name: true, email: true },
  });
}

export async function updateStaff(input: UpdateStaffInput, actingUserId: string) {
  const { id, password, doctor, ...user } = input;

  const existing = await prisma.user.findUnique({
    where: { id },
    include: { doctorProfile: { select: { id: true } } },
  });
  if (!existing) throw new NotFoundError("Staff member");

  if (user.email !== existing.email) {
    const clash = await prisma.user.findFirst({
      where: { email: user.email, id: { not: id } },
      select: { id: true },
    });
    if (clash) {
      throw new BusinessRuleError("An account with that email already exists.", {
        email: ["This email is already registered."],
      });
    }
  }

  // An administrator must not lock themselves out, and the clinic must always
  // keep at least one active administrator.
  if (id === actingUserId) {
    if (!user.isActive) {
      throw new BusinessRuleError("You cannot deactivate your own account.");
    }
    if (existing.role === "ADMIN" && user.role !== "ADMIN") {
      throw new BusinessRuleError("You cannot remove your own administrator role.");
    }
  }

  if (existing.role === "ADMIN" && (user.role !== "ADMIN" || !user.isActive)) {
    const otherAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true, id: { not: id } },
    });
    if (otherAdmins === 0) {
      throw new BusinessRuleError(
        "The clinic must keep at least one active administrator.",
      );
    }
  }

  if (existing.role === "DOCTOR" && user.role !== "DOCTOR") {
    const openVisits = await prisma.appointment.count({
      where: {
        doctor: { userId: id },
        status: { in: ["SCHEDULED", "CHECKED_IN", "IN_CONSULTATION"] },
      },
    });
    if (openVisits > 0) {
      throw new BusinessRuleError(
        `This doctor still has ${openVisits} open appointment${openVisits === 1 ? "" : "s"}. Reassign or cancel them first.`,
      );
    }
  }

  const data: Prisma.UserUpdateInput = { ...user };
  if (password) data.passwordHash = await hashPassword(password);

  if (user.role === "DOCTOR" && doctor) {
    data.doctorProfile = existing.doctorProfile
      ? { update: doctor }
      : { create: doctor };
  }

  return prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true },
  });
}
