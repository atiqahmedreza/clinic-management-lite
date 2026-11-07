import "server-only";

import type { InvoiceStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { BusinessRuleError, NotFoundError } from "@/lib/errors";
import { PAGE_SIZE } from "@/lib/constants";
import { round2, serialize, toNumber } from "@/lib/serialize";
import { formatCurrency } from "@/lib/utils";
import { nextInvoiceNumber, withCodeRetry } from "@/lib/services/codes";
import type {
  CreateInvoiceInput,
  RecordPaymentInput,
  ServiceInput,
} from "@/lib/validations/billing";

// ---------------------------------------------------------------------------
// Invoice reads
// ---------------------------------------------------------------------------

export type InvoiceFilters = {
  search?: string;
  status?: InvoiceStatus;
  patientId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export async function listInvoices(filters: InvoiceFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? PAGE_SIZE;

  const where: Prisma.InvoiceWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.patientId) where.patientId = filters.patientId;
  if (filters.from || filters.to) {
    where.issuedAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { number: { contains: search, mode: "insensitive" } },
      { patient: { firstName: { contains: search, mode: "insensitive" } } },
      { patient: { lastName: { contains: search, mode: "insensitive" } } },
      { patient: { mrn: { contains: search, mode: "insensitive" } } },
      { patient: { phone: { contains: search.replace(/\D/g, "") || search } } },
    ];
  }

  const [rows, total, aggregate] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        patient: {
          select: { id: true, mrn: true, firstName: true, lastName: true },
        },
        _count: { select: { items: true, payments: true } },
      },
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({
      where: { ...where, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
  ]);

  const billed = toNumber(aggregate._sum.totalAmount);
  const collected = toNumber(aggregate._sum.paidAmount);

  return {
    rows: serialize(rows),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    totals: {
      billed,
      collected,
      outstanding: round2(Math.max(0, billed - collected)),
    },
  };
}

export type InvoiceRow = Awaited<ReturnType<typeof listInvoices>>["rows"][number];

export async function getInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      patient: true,
      createdBy: { select: { name: true } },
      items: { include: { service: { select: { code: true, name: true } } } },
      payments: {
        orderBy: { paidAt: "desc" },
        include: { receivedBy: { select: { name: true } } },
      },
      consultation: {
        select: {
          id: true,
          diagnosis: true,
          createdAt: true,
          doctor: {
            select: {
              specialization: true,
              user: { select: { name: true } },
            },
          },
          appointment: { select: { code: true, scheduledAt: true } },
        },
      },
    },
  });
  if (!invoice) throw new NotFoundError("Invoice");

  const balanceDue = round2(
    toNumber(invoice.totalAmount) - toNumber(invoice.paidAmount),
  );

  return serialize({ ...invoice, balanceDue });
}

export type InvoiceDetail = Awaited<ReturnType<typeof getInvoice>>;

/**
 * Builds the pre-filled invoice for a finished consultation: the attending
 * doctor's consultation fee, plus the catalogue the receptionist can add to.
 */
export async function getInvoiceDraft(consultationId: string) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: {
      patient: {
        select: { id: true, mrn: true, firstName: true, lastName: true, phone: true },
      },
      doctor: {
        select: {
          consultationFee: true,
          specialization: true,
          user: { select: { name: true } },
        },
      },
      appointment: { select: { code: true, status: true, scheduledAt: true, type: true } },
      invoice: { select: { id: true, number: true } },
    },
  });

  if (!consultation) throw new NotFoundError("Consultation");

  if (consultation.invoice) {
    throw new BusinessRuleError(
      `This visit has already been billed on invoice ${consultation.invoice.number}.`,
    );
  }

  if (consultation.appointment.status !== "COMPLETED") {
    throw new BusinessRuleError(
      "The consultation must be completed before an invoice can be raised.",
    );
  }

  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return serialize({
    consultation,
    services,
    suggestedItems: [
      {
        serviceId: undefined as string | undefined,
        description: `${consultation.appointment.type === "FOLLOW_UP" ? "Follow-up" : "Consultation"} — ${consultation.doctor.user.name} (${consultation.doctor.specialization})`,
        quantity: 1,
        unitPrice: toNumber(consultation.doctor.consultationFee),
      },
    ],
  });
}

export type InvoiceDraft = Awaited<ReturnType<typeof getInvoiceDraft>>;

// ---------------------------------------------------------------------------
// Invoice writes
// ---------------------------------------------------------------------------

export async function createInvoice(
  input: CreateInvoiceInput,
  createdById: string,
) {
  const patient = await prisma.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true },
  });
  if (!patient) throw new NotFoundError("Patient");

  if (input.consultationId) {
    const consultation = await prisma.consultation.findUnique({
      where: { id: input.consultationId },
      select: {
        id: true,
        patientId: true,
        invoice: { select: { number: true } },
        appointment: { select: { status: true } },
      },
    });
    if (!consultation) throw new NotFoundError("Consultation");
    if (consultation.invoice) {
      throw new BusinessRuleError(
        `This visit has already been billed on invoice ${consultation.invoice.number}.`,
      );
    }
    if (consultation.patientId !== input.patientId) {
      throw new BusinessRuleError(
        "The consultation belongs to a different patient.",
      );
    }
    if (consultation.appointment.status !== "COMPLETED") {
      throw new BusinessRuleError(
        "The consultation must be completed before an invoice can be raised.",
      );
    }
  }

  // Prices are re-read from the catalogue on the server so a tampered form
  // cannot change what a listed service costs.
  const serviceIds = input.items
    .map((item) => item.serviceId)
    .filter((value): value is string => Boolean(value));

  const catalogue = serviceIds.length
    ? await prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, name: true, price: true, isActive: true },
      })
    : [];
  const catalogueById = new Map(catalogue.map((item) => [item.id, item]));

  const items = input.items.map((item) => {
    if (item.serviceId) {
      const service = catalogueById.get(item.serviceId);
      if (!service) throw new NotFoundError("Service");
      if (!service.isActive) {
        throw new BusinessRuleError(
          `"${service.name}" is no longer offered and cannot be billed.`,
        );
      }
      const unitPrice = toNumber(service.price);
      return {
        serviceId: service.id,
        description: item.description || service.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal: round2(unitPrice * item.quantity),
      };
    }
    return {
      serviceId: null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: round2(item.unitPrice),
      lineTotal: round2(item.unitPrice * item.quantity),
    };
  });

  const subtotal = round2(
    items.reduce((sum, item) => sum + item.lineTotal, 0),
  );
  const discountAmount = round2(input.discountAmount);
  const taxAmount = round2(input.taxAmount);

  if (discountAmount > subtotal) {
    throw new BusinessRuleError(
      `The discount (${formatCurrency(discountAmount)}) cannot be more than the subtotal (${formatCurrency(subtotal)}).`,
      { discountAmount: ["Discount exceeds the subtotal."] },
    );
  }

  const totalAmount = round2(subtotal - discountAmount + taxAmount);
  if (totalAmount <= 0) {
    throw new BusinessRuleError(
      "An invoice total must be greater than zero.",
    );
  }

  return withCodeRetry(async () =>
    prisma.$transaction(async (tx) => {
      const number = await nextInvoiceNumber(tx);
      return tx.invoice.create({
        data: {
          number,
          patientId: input.patientId,
          consultationId: input.consultationId ?? null,
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          paidAmount: 0,
          status: "UNPAID",
          notes: input.notes,
          createdById,
          items: { create: items },
        },
        select: { id: true, number: true, totalAmount: true },
      });
    }),
  );
}

/**
 * Records a payment against an invoice and recalculates its status.
 *
 * This is the rule the brief calls out explicitly: you can never take more
 * money than the invoice is owed.
 */
export async function recordPayment(
  input: RecordPaymentInput,
  receivedById: string,
) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: input.invoiceId },
      select: {
        id: true,
        number: true,
        status: true,
        totalAmount: true,
        paidAmount: true,
      },
    });
    if (!invoice) throw new NotFoundError("Invoice");

    if (invoice.status === "CANCELLED") {
      throw new BusinessRuleError(
        `Invoice ${invoice.number} has been cancelled and cannot take payments.`,
      );
    }

    const total = toNumber(invoice.totalAmount);
    const alreadyPaid = toNumber(invoice.paidAmount);
    const balance = round2(total - alreadyPaid);

    if (balance <= 0) {
      throw new BusinessRuleError(
        `Invoice ${invoice.number} is already settled in full.`,
      );
    }

    const amount = round2(input.amount);
    if (amount > balance) {
      throw new BusinessRuleError(
        `That payment is ${formatCurrency(round2(amount - balance))} more than the outstanding balance of ${formatCurrency(balance)}.`,
        { amount: [`Maximum accepted right now is ${formatCurrency(balance)}.`] },
      );
    }

    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        method: input.method,
        reference: input.reference,
        note: input.note,
        receivedById,
      },
    });

    const paidAmount = round2(alreadyPaid + amount);
    const status: InvoiceStatus =
      paidAmount >= total ? "PAID" : paidAmount > 0 ? "PARTIALLY_PAID" : "UNPAID";

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { paidAmount, status },
    });

    return {
      id: invoice.id,
      number: invoice.number,
      paidAmount,
      balanceDue: round2(total - paidAmount),
      status,
    };
  });
}

export async function cancelInvoice(id: string, reason: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      status: true,
      notes: true,
      _count: { select: { payments: true } },
    },
  });
  if (!invoice) throw new NotFoundError("Invoice");

  if (invoice.status === "CANCELLED") {
    throw new BusinessRuleError(`Invoice ${invoice.number} is already cancelled.`);
  }
  if (invoice._count.payments > 0) {
    throw new BusinessRuleError(
      `Invoice ${invoice.number} already has payments recorded against it and cannot be cancelled. Issue a refund instead.`,
    );
  }

  return prisma.invoice.update({
    where: { id },
    data: {
      status: "CANCELLED",
      notes: [invoice.notes, `Cancelled: ${reason}`].filter(Boolean).join("\n"),
    },
    select: { id: true, number: true },
  });
}

// ---------------------------------------------------------------------------
// Service catalogue
// ---------------------------------------------------------------------------

export async function listServices(filters: {
  search?: string;
  category?: string;
  includeInactive?: boolean;
} = {}) {
  const where: Prisma.ServiceWhereInput = {};
  if (!filters.includeInactive) where.isActive = true;
  if (filters.category) {
    where.category = filters.category as Prisma.ServiceWhereInput["category"];
  }
  if (filters.search?.trim()) {
    const term = filters.search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { code: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.service.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return serialize(rows);
}

export type ServiceRow = Awaited<ReturnType<typeof listServices>>[number];

export async function createService(input: ServiceInput) {
  return prisma.service.create({ data: input, select: { id: true, name: true } });
}

export async function updateService(id: string, input: ServiceInput) {
  const existing = await prisma.service.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Service");
  return prisma.service.update({
    where: { id },
    data: input,
    select: { id: true, name: true },
  });
}
