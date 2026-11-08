import * as React from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-[var(--radius-control)] border bg-surface px-3 text-[15px] text-ink " +
  "transition-colors duration-150 " +
  "border-line-strong placeholder:text-ink-muted " +
  "focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)] " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted " +
  "aria-[invalid=true]:border-[var(--danger)] aria-[invalid=true]:ring-[var(--danger-soft)]";

// ---------------------------------------------------------------------------
// Field shell: label + control + hint/error, wired up with ids so screen
// readers announce the error with the input.
// ---------------------------------------------------------------------------

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string[] | string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-ink-secondary"
      >
        {label}
        {required ? (
          <span className="ml-0.5 text-[var(--danger)]" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {message ? (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-sm text-[var(--danger)]"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{message}</span>
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${props.id}-error` : undefined}
      className={cn(controlBase, "h-10", className)}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${props.id}-error` : undefined}
      className={cn(controlBase, "resize-y py-2 leading-relaxed", className)}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${props.id}-error` : undefined}
        className={cn(
          controlBase,
          "h-10 cursor-pointer appearance-none pr-9",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden
      >
        <path
          d="m6 8 4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});

export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  description?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] border border-line p-3 transition-colors duration-150 hover:bg-surface-muted",
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong accent-[var(--brand)]"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-sm text-ink-muted">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/** A compact inline checkbox, used for weekday pickers. */
export function ToggleChip({
  label,
  checked,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        checked
          ? "border-[var(--brand)] bg-brand-soft text-brand-ink"
          : "border-line-strong text-ink-secondary hover:bg-surface-muted",
      )}
    >
      <input type="checkbox" className="sr-only" checked={checked} {...props} />
      {label}
    </label>
  );
}

export { controlBase };
