"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Wallet } from "lucide-react";

import {
  cancelInvoiceAction,
  recordPaymentAction,
  type InvoiceActionState,
  type PaymentActionState,
} from "@/actions/billing.actions";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/**
 * Records a payment against an invoice. The server refuses anything above the
 * outstanding balance; this form mirrors that rule so the user sees it before
 * submitting.
 */
export function PaymentForm({
  invoiceId,
  balanceDue,
}: {
  invoiceId: string;
  balanceDue: number;
}) {
  const router = useRouter();
  const toast = useToast();

  const [state, formAction] = useActionState<PaymentActionState, FormData>(
    recordPaymentAction,
    null,
  );
  const [amount, setAmount] = React.useState<string>(balanceDue.toFixed(2));

  React.useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? "Payment recorded.");
    setAmount("0");
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  React.useEffect(() => {
    setAmount(balanceDue > 0 ? balanceDue.toFixed(2) : "0");
  }, [balanceDue]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const topError = state && !state.ok ? state.error : undefined;

  const numericAmount = Number(amount) || 0;
  const overBalance = numericAmount > balanceDue;

  if (balanceDue <= 0) {
    return (
      <Card>
        <CardBody className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success-ink">
            <BadgeCheck className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Settled in full</p>
            <p className="text-sm text-ink-muted">
              Nothing further is owed on this invoice.
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Record a payment"
        description={`Outstanding balance ${formatCurrency(balanceDue)}`}
        icon={<Wallet className="h-4 w-4" aria-hidden />}
      />
      <form action={formAction} noValidate>
        <input type="hidden" name="invoiceId" value={invoiceId} />

        <CardBody className="space-y-4">
          {topError ? (
            <Alert variant="error" title="Payment not recorded">
              {topError}
            </Alert>
          ) : null}

          <Field
            label="Amount"
            htmlFor="amount"
            required
            error={
              overBalance
                ? `The balance is only ${formatCurrency(balanceDue)}.`
                : errors?.amount
            }
          >
            <Input
              id="amount"
              name="amount"
              type="number"
              min={0.01}
              max={balanceDue}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              invalid={overBalance || Boolean(errors?.amount)}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            {[balanceDue, balanceDue / 2].map((preset, index) => (
              <Button
                key={index}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setAmount(round2(preset).toFixed(2))}
              >
                {index === 0 ? "Full balance" : "Half"} ·{" "}
                {formatCurrency(round2(preset))}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Method" htmlFor="method" required error={errors?.method}>
              <Select id="method" name="method" defaultValue="CASH">
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Reference"
              htmlFor="reference"
              error={errors?.reference}
              hint="bKash / card trace number"
            >
              <Input id="reference" name="reference" placeholder="Optional" />
            </Field>
          </div>

          <Field label="Note" htmlFor="note" error={errors?.note}>
            <Textarea id="note" name="note" rows={2} placeholder="Optional" />
          </Field>
        </CardBody>

        <CardFooter>
          <SubmitButton
            pendingLabel="Recording…"
            disabled={overBalance || numericAmount <= 0}
          >
            Record {formatCurrency(numericAmount)}
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}

/** Voids an invoice that has no payments against it. */
export function CancelInvoiceButton({
  invoiceId,
  invoiceNumber,
  hasPayments,
}: {
  invoiceId: string;
  invoiceNumber: string;
  hasPayments: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const confirm = async () => {
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("id", invoiceId);
    formData.set("reason", reason);

    const result: InvoiceActionState = await cancelInvoiceAction(null, formData);
    setPending(false);

    if (result?.ok) {
      setOpen(false);
      toast.success(result.message ?? "Invoice cancelled.");
      router.refresh();
    } else {
      setError(result?.error ?? "Could not cancel this invoice.");
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        disabled={hasPayments}
        title={
          hasPayments
            ? "Invoices with recorded payments cannot be cancelled"
            : undefined
        }
      >
        Cancel invoice
      </Button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        loading={pending}
        title={`Cancel ${invoiceNumber}?`}
        confirmLabel="Cancel invoice"
        message="The invoice is voided and stops counting towards revenue or outstanding dues. This cannot be undone."
      >
        <Field label="Reason" htmlFor="cancelReason" required error={error ?? undefined}>
          <Textarea
            id="cancelReason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Billed in error…"
            invalid={Boolean(error)}
          />
        </Field>
      </ConfirmDialog>
    </>
  );
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
