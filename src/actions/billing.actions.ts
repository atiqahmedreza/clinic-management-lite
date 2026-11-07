"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/session";
import { ok, toActionFailure, type ActionResult } from "@/lib/errors";
import {
  cancelInvoice,
  createInvoice,
  createService,
  recordPayment,
  updateService,
} from "@/lib/services/billing.service";
import {
  createInvoiceSchema,
  recordPaymentSchema,
  serviceSchema,
  updateServiceSchema,
  type InvoiceItemInput,
} from "@/lib/validations/billing";
import { formToObject, readJsonField } from "@/actions/helpers";

export type InvoiceActionState = ActionResult<{
  id: string;
  number: string;
}> | null;

function revalidateBilling(invoiceId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath("/consultations");
  if (invoiceId) revalidatePath(`/invoices/${invoiceId}`);
}

export async function createInvoiceAction(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  try {
    const session = await requireRole("RECEPTIONIST");

    const input = createInvoiceSchema.parse({
      ...formToObject(formData),
      items: readJsonField<InvoiceItemInput[]>(formData, "items", []),
    });

    const invoice = await createInvoice(input, session.sub);

    revalidateBilling(invoice.id);
    revalidatePath("/patients");

    return ok(
      { id: invoice.id, number: invoice.number },
      `Invoice ${invoice.number} created.`,
    );
  } catch (error) {
    return toActionFailure(error);
  }
}

export type PaymentActionState = ActionResult<{
  id: string;
  number: string;
  balanceDue: number;
}> | null;

export async function recordPaymentAction(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  try {
    const session = await requireRole("RECEPTIONIST");
    const input = recordPaymentSchema.parse(formToObject(formData));
    const result = await recordPayment(input, session.sub);

    revalidateBilling(result.id);
    revalidatePath("/patients");

    return ok(
      { id: result.id, number: result.number, balanceDue: result.balanceDue },
      result.balanceDue === 0
        ? `Payment recorded. Invoice ${result.number} is now settled in full.`
        : `Payment recorded against ${result.number}.`,
    );
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function cancelInvoiceAction(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  try {
    await requireRole("RECEPTIONIST");
    const id = String(formData.get("id") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length < 3) {
      return {
        ok: false,
        error: "Give a short reason for cancelling this invoice.",
        fieldErrors: { reason: ["A reason is required."] },
      };
    }
    const invoice = await cancelInvoice(id, reason);
    revalidateBilling(invoice.id);
    return ok(
      { id: invoice.id, number: invoice.number },
      `Invoice ${invoice.number} cancelled.`,
    );
  } catch (error) {
    return toActionFailure(error);
  }
}

// ---------------------------------------------------------------------------
// Service catalogue (admin)
// ---------------------------------------------------------------------------

export type ServiceActionState = ActionResult<{
  id: string;
  name: string;
}> | null;

export async function saveServiceAction(
  _prev: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  try {
    await requireRole("ADMIN");
    const raw = {
      ...formToObject(formData),
      isActive: formData.get("isActive") === "on",
    };
    const id = formData.get("id");

    if (typeof id === "string" && id.length > 0) {
      const input = updateServiceSchema.parse({ ...raw, id });
      const service = await updateService(input.id, input);
      revalidatePath("/services");
      return ok({ id: service.id, name: service.name }, `${service.name} updated.`);
    }

    const input = serviceSchema.parse(raw);
    const service = await createService(input);
    revalidatePath("/services");
    return ok({ id: service.id, name: service.name }, `${service.name} added to the price list.`);
  } catch (error) {
    return toActionFailure(error);
  }
}
