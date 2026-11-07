"use client";

import * as React from "react";
import { Pill, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";

export type PrescriptionRow = {
  key: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
};

const FREQUENCIES = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "Every 6 hours",
  "Every 8 hours",
  "At bedtime",
  "As needed",
];

export function newPrescriptionRow(): PrescriptionRow {
  return {
    key: Math.random().toString(36).slice(2),
    medicineName: "",
    dosage: "",
    frequency: "Twice daily",
    durationDays: 5,
    instructions: "",
  };
}

/**
 * Repeating prescription rows. The whole collection is posted as one JSON
 * field so it arrives with the rest of the consultation in a single action.
 */
export function PrescriptionEditor({
  rows,
  onChange,
  error,
}: {
  rows: PrescriptionRow[];
  onChange: (rows: PrescriptionRow[]) => void;
  error?: string;
}) {
  const update = (key: string, patch: Partial<PrescriptionRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const remove = (key: string) =>
    onChange(rows.filter((row) => row.key !== key));

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name="prescriptions"
        value={JSON.stringify(
          rows
            .filter((row) => row.medicineName.trim().length > 0)
            .map(({ key: _key, instructions, ...row }) => ({
              ...row,
              instructions: instructions.trim() || undefined,
            })),
        )}
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center">
          <Pill className="mx-auto h-5 w-5 text-ink-muted" aria-hidden />
          <p className="mt-2 text-sm text-ink-muted">
            No medicines prescribed yet.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className="rounded-lg border border-line bg-surface-muted/50 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Medicine {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(row.key)}
                  aria-label={`Remove medicine ${index + 1}`}
                  className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface hover:text-[var(--danger)]"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <label className="sr-only" htmlFor={`medicine-${row.key}`}>
                    Medicine name
                  </label>
                  <Input
                    id={`medicine-${row.key}`}
                    value={row.medicineName}
                    onChange={(event) =>
                      update(row.key, { medicineName: event.target.value })
                    }
                    placeholder="Medicine name"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="sr-only" htmlFor={`dosage-${row.key}`}>
                    Dosage
                  </label>
                  <Input
                    id={`dosage-${row.key}`}
                    value={row.dosage}
                    onChange={(event) =>
                      update(row.key, { dosage: event.target.value })
                    }
                    placeholder="500 mg"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="sr-only" htmlFor={`frequency-${row.key}`}>
                    Frequency
                  </label>
                  <Select
                    id={`frequency-${row.key}`}
                    value={row.frequency}
                    onChange={(event) =>
                      update(row.key, { frequency: event.target.value })
                    }
                  >
                    {FREQUENCIES.map((frequency) => (
                      <option key={frequency} value={frequency}>
                        {frequency}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="sm:col-span-3">
                  <label className="sr-only" htmlFor={`duration-${row.key}`}>
                    Duration in days
                  </label>
                  <Input
                    id={`duration-${row.key}`}
                    type="number"
                    min={1}
                    max={365}
                    value={row.durationDays}
                    onChange={(event) =>
                      update(row.key, {
                        durationDays: Number(event.target.value) || 1,
                      })
                    }
                    placeholder="Days"
                  />
                </div>

                <div className="sm:col-span-9">
                  <label className="sr-only" htmlFor={`instructions-${row.key}`}>
                    Instructions
                  </label>
                  <Input
                    id={`instructions-${row.key}`}
                    value={row.instructions}
                    onChange={(event) =>
                      update(row.key, { instructions: event.target.value })
                    }
                    placeholder="After meals, with water…"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onChange([...rows, newPrescriptionRow()])}
        icon={<Plus className="h-3.5 w-3.5" aria-hidden />}
      >
        Add medicine
      </Button>
    </div>
  );
}
