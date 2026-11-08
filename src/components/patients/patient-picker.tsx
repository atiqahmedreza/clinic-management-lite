"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Loader2, Search, UserPlus, X } from "lucide-react";

import { searchPatientsAction } from "@/actions/patient.actions";
import type { PatientPickerOption } from "@/lib/services/patient.service";
import { cn, describeAge } from "@/lib/utils";
import { controlBase } from "@/components/ui/field";
import { Avatar } from "@/components/ui/badge";

/**
 * Type-ahead patient search. Posts the chosen patient's id in a hidden input
 * so the enclosing form works as a plain FormData submission.
 */
export function PatientPicker({
  name = "patientId",
  initialPatient,
  invalid,
  describedBy,
}: {
  name?: string;
  initialPatient?: PatientPickerOption | null;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [selected, setSelected] = React.useState<PatientPickerOption | null>(
    initialPatient ?? null,
  );
  const [term, setTerm] = React.useState("");
  const [results, setResults] = React.useState<PatientPickerOption[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputId = React.useId();
  const listId = `${inputId}-list`;

  // Close on outside click.
  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced search.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const rows = await searchPatientsAction(term);
        if (!cancelled) {
          setResults(rows);
          setHighlight(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term, open]);

  const choose = (patient: PatientPickerOption) => {
    setSelected(patient);
    setOpen(false);
    setTerm("");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      const patient = results[highlight];
      if (patient) {
        event.preventDefault();
        choose(patient);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--brand)] bg-brand-soft/60 px-3 py-2.5">
        <input type="hidden" name={name} value={selected.id} />
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            name={`${selected.firstName} ${selected.lastName}`}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {selected.firstName} {selected.lastName}
            </p>
            <p className="tabular truncate text-xs text-ink-secondary">
              {selected.mrn} · {selected.phone} ·{" "}
              {describeAge(selected.dateOfBirth)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setOpen(true);
          }}
          className="shrink-0 rounded-[var(--radius-control)] p-1.5 text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          aria-label="Choose a different patient"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value="" />
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        aria-hidden
      />
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search by name, MRN or phone…"
        className={cn(controlBase, "h-10 pl-9 pr-9")}
        autoComplete="off"
      />
      {loading ? (
        <Loader2
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-muted"
          aria-hidden
        />
      ) : null}

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface py-1 shadow-[var(--shadow-pop)]"
        >
          {results.length === 0 && !loading ? (
            <div className="px-3 py-4 text-center">
              <p className="text-sm text-ink-secondary">
                {term ? `No patient matches “${term}”.` : "No patients yet."}
              </p>
              <Link
                href="/patients/new?next=book"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink hover:underline"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden />
                Register a new patient
              </Link>
            </div>
          ) : (
            results.map((patient, index) => (
              <button
                key={patient.id}
                type="button"
                role="option"
                aria-selected={index === highlight}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(patient)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                  index === highlight ? "bg-surface-muted" : "",
                )}
              >
                <Avatar
                  name={`${patient.firstName} ${patient.lastName}`}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {patient.firstName} {patient.lastName}
                  </span>
                  <span className="tabular block truncate text-xs text-ink-muted">
                    {patient.mrn} · {patient.phone}
                  </span>
                </span>
                {index === highlight ? (
                  <Check className="h-4 w-4 shrink-0 text-brand-ink" aria-hidden />
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
