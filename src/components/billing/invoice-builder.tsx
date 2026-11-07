"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ReceiptText, Trash2 } from "lucide-react";

import {
  createInvoiceAction,
  type InvoiceActionState,
} from "@/actions/billing.actions";
import type { ServiceRow } from "@/lib/services/billing.service";
import { SERVICE_CATEGORY_META } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

type LineItem = {
  key: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Fixed-price catalogue items cannot be repriced on the invoice. */
  locked: boolean;
};

export type InvoiceBuilderProps = {
  patientId: string;
  patientLabel: string;
  consultationId?: string;
  services: ServiceRow[];
  initialItems: {
    serviceId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
  cancelHref: string;
};

export function InvoiceBuilder({
  patientId,
  patientLabel,
  consultationId,
  services,
  initialItems,
  cancelHref,
}: InvoiceBuilderProps) {
  const router = useRouter();
  const toast = useToast();

  const [state, formAction] = useActionState<InvoiceActionState, FormData>(
    createInvoiceAction,
    null,
  );

  const [items, setItems] = React.useState<LineItem[]>(() =>
    initialItems.map((item) => ({
      key: randomKey(),
      serviceId: item.serviceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      locked: Boolean(item.serviceId),
    })),
  );
  const [discount, setDiscount] = React.useState(0);
  const [tax, setTax] = React.useState(0);
  const [picker, setPicker] = React.useState("");

  React.useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? "Invoice created.");
    router.push(`/invoices/${state.data.id}`);
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const topError = state && !state.ok ? state.error : undefined;

  const subtotal = round2(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  );
  const total = round2(subtotal - discount + tax);
  const discountTooHigh = discount > subtotal;

  const addService = (serviceId: string) => {
    const service = services.find((item) => item.id === serviceId);
    if (!service) return;
    setItems((current) => [
      ...current,
      {
        key: randomKey(),
        serviceId: service.id,
        description: service.name,
        quantity: 1,
        unitPrice: service.price,
        locked: true,
      },
    ]);
    setPicker("");
  };

  const addCustom = () =>
    setItems((current) => [
      ...current,
      {
        key: randomKey(),
        description: "",
        quantity: 1,
        unitPrice: 0,
        locked: false,
      },
    ]);

  const update = (key: string, patch: Partial<LineItem>) =>
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );

  const remove = (key: string) =>
    setItems((current) => current.filter((item) => item.key !== key));

  const grouped = React.useMemo(() => {
    const map = new Map<string, ServiceRow[]>();
    for (const service of services) {
      const list = map.get(service.category) ?? [];
      list.push(service);
      map.set(service.category, list);
    }
    return [...map.entries()];
  }, [services]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="patientId" value={patientId} />
      {consultationId ? (
        <input type="hidden" name="consultationId" value={consultationId} />
      ) : null}
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          items
            .filter((item) => item.description.trim().length > 0)
            .map((item) => ({
              serviceId: item.serviceId,
              description: item.description.trim(),
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
        )}
      />

      {topError ? (
        <Alert variant="error" title="Could not create the invoice">
          {topError}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Charges"
          description={`Billing ${patientLabel}`}
          icon={<ReceiptText className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="space-y-4">
          {/* ---- add from the price list ---- */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <label htmlFor="service-picker" className="sr-only">
                Add a service from the price list
              </label>
              <Select
                id="service-picker"
                value={picker}
                onChange={(event) => addService(event.target.value)}
              >
                <option value="">Add from the price list…</option>
                {grouped.map(([category, list]) => (
                  <optgroup
                    key={category}
                    label={
                      SERVICE_CATEGORY_META[
                        category as keyof typeof SERVICE_CATEGORY_META
                      ]?.label ?? category
                    }
                  >
                    {list.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} — {formatCurrency(service.price)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>
            <button
              type="button"
              onClick={addCustom}
              className={buttonClasses("secondary", "md", "sm:w-auto")}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Custom line
            </button>
          </div>

          {/* ---- line items ---- */}
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center">
              <p className="text-sm text-ink-muted">
                No charges yet. Add a service from the price list, or a custom
                line.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {items.map((item, index) => (
                <li
                  key={item.key}
                  className="rounded-lg border border-line bg-surface-muted/50 p-3"
                >
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 sm:items-center">
                    <div className="sm:col-span-6">
                      <label className="sr-only" htmlFor={`desc-${item.key}`}>
                        Description for line {index + 1}
                      </label>
                      <Input
                        id={`desc-${item.key}`}
                        value={item.description}
                        onChange={(event) =>
                          update(item.key, { description: event.target.value })
                        }
                        placeholder="What is being charged"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="sr-only" htmlFor={`qty-${item.key}`}>
                        Quantity for line {index + 1}
                      </label>
                      <Input
                        id={`qty-${item.key}`}
                        type="number"
                        min={1}
                        max={100}
                        value={item.quantity}
                        onChange={(event) =>
                          update(item.key, {
                            quantity: Math.max(
                              1,
                              Number(event.target.value) || 1,
                            ),
                          })
                        }
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="sr-only" htmlFor={`price-${item.key}`}>
                        Unit price for line {index + 1}
                      </label>
                      <Input
                        id={`price-${item.key}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        disabled={item.locked}
                        title={
                          item.locked
                            ? "Price comes from the clinic price list"
                            : undefined
                        }
                        onChange={(event) =>
                          update(item.key, {
                            unitPrice: Math.max(
                              0,
                              Number(event.target.value) || 0,
                            ),
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end">
                      <span className="tabular text-sm font-medium text-ink sm:hidden">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(item.key)}
                        aria-label={`Remove line ${index + 1}`}
                        className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface hover:text-[var(--danger)]"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>

                  <p className="tabular mt-2 hidden text-right text-sm text-ink-secondary sm:block">
                    Line total:{" "}
                    <span className="font-semibold text-ink">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}

          {errors?.items ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {errors.items[0]}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {/* ---- totals ---- */}
      <Card>
        <CardHeader title="Totals" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Discount"
              htmlFor="discountAmount"
              error={
                discountTooHigh
                  ? "Discount cannot be greater than the subtotal."
                  : errors?.discountAmount
              }
            >
              <Input
                id="discountAmount"
                name="discountAmount"
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(event) =>
                  setDiscount(Math.max(0, Number(event.target.value) || 0))
                }
                invalid={discountTooHigh || Boolean(errors?.discountAmount)}
              />
            </Field>

            <Field label="Tax / VAT" htmlFor="taxAmount" error={errors?.taxAmount}>
              <Input
                id="taxAmount"
                name="taxAmount"
                type="number"
                min={0}
                step="0.01"
                value={tax}
                onChange={(event) =>
                  setTax(Math.max(0, Number(event.target.value) || 0))
                }
              />
            </Field>
          </div>

          <dl className="space-y-2 rounded-lg bg-surface-muted p-4">
            <TotalRow label="Subtotal" value={subtotal} />
            {discount > 0 ? (
              <TotalRow label="Discount" value={-discount} />
            ) : null}
            {tax > 0 ? <TotalRow label="Tax" value={tax} /> : null}
            <div className="border-t border-line pt-2">
              <TotalRow label="Total payable" value={total} emphasis />
            </div>
          </dl>

          <Field label="Notes" htmlFor="notes" error={errors?.notes}>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder="Optional note printed on the invoice"
            />
          </Field>
        </CardBody>

        <CardFooter>
          <Link href={cancelHref} className={buttonClasses("secondary", "md")}>
            Cancel
          </Link>
          <SubmitButton
            pendingLabel="Creating…"
            disabled={items.length === 0 || total <= 0 || discountTooHigh}
          >
            Create invoice · {formatCurrency(total)}
          </SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}

function TotalRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt
        className={cn(
          "text-sm",
          emphasis ? "font-semibold text-ink" : "text-ink-secondary",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "tabular text-sm",
          emphasis ? "text-base font-semibold text-ink" : "text-ink",
        )}
      >
        {formatCurrency(value)}
      </dd>
    </div>
  );
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function randomKey(): string {
  return Math.random().toString(36).slice(2);
}
