"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import {
  saveServiceAction,
  type ServiceActionState,
} from "@/actions/billing.actions";
import { SERVICE_CATEGORY_OPTIONS } from "@/lib/constants";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

export type ServiceFormValues = {
  id?: string;
  code?: string;
  name?: string;
  category?: string;
  price?: number;
  description?: string | null;
  isActive?: boolean;
};

export function ServiceForm({
  defaults,
  onDone,
}: {
  defaults?: ServiceFormValues;
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState<ServiceActionState, FormData>(
    saveServiceAction,
    null,
  );

  const editing = Boolean(defaults?.id);

  React.useEffect(() => {
    if (!state?.ok) return;
    toast.success(state.message ?? "Saved.");
    if (!editing) formRef.current?.reset();
    router.refresh();
    onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const topError = state && !state.ok ? state.error : undefined;

  return (
    <Card>
      <CardHeader
        title={editing ? `Edit ${defaults?.name}` : "Add a service"}
        description={
          editing
            ? "Changing a price affects new invoices only."
            : "Items the front desk can add to an invoice."
        }
      />
      <form ref={formRef} action={formAction} noValidate>
        {defaults?.id ? (
          <input type="hidden" name="id" value={defaults.id} />
        ) : null}

        <CardBody className="space-y-4">
          {topError ? (
            <Alert variant="error" title="Could not save">
              {topError}
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Code"
              htmlFor="code"
              required
              error={errors?.code}
              hint="e.g. LAB-CBC"
            >
              <Input
                id="code"
                name="code"
                defaultValue={defaults?.code ?? ""}
                placeholder="CONS-GEN"
                required
                invalid={Boolean(errors?.code)}
              />
            </Field>

            <Field
              label="Price"
              htmlFor="price"
              required
              error={errors?.price}
            >
              <Input
                id="price"
                name="price"
                type="number"
                min={0}
                step="0.01"
                defaultValue={defaults?.price ?? ""}
                placeholder="500.00"
                required
                invalid={Boolean(errors?.price)}
              />
            </Field>
          </div>

          <Field label="Name" htmlFor="name" required error={errors?.name}>
            <Input
              id="name"
              name="name"
              defaultValue={defaults?.name ?? ""}
              placeholder="Complete blood count"
              required
              invalid={Boolean(errors?.name)}
            />
          </Field>

          <Field
            label="Category"
            htmlFor="category"
            required
            error={errors?.category}
          >
            <Select
              id="category"
              name="category"
              defaultValue={defaults?.category ?? "OTHER"}
            >
              {SERVICE_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            error={errors?.description}
          >
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={defaults?.description ?? ""}
              placeholder="Optional"
            />
          </Field>

          <Checkbox
            name="isActive"
            label="Available for billing"
            description="Inactive services stay on past invoices but cannot be added to new ones."
            defaultChecked={defaults?.isActive ?? true}
          />
        </CardBody>

        <CardFooter>
          {editing && onDone ? (
            <Button type="button" variant="secondary" onClick={onDone}>
              Cancel
            </Button>
          ) : null}
          <SubmitButton pendingLabel="Saving…">
            {editing ? "Save changes" : "Add service"}
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
