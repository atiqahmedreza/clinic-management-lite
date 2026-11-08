import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "subtle";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium " +
  "transition-colors duration-150 select-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] " +
  "disabled:pointer-events-none disabled:opacity-55";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand)] text-[var(--ink-inverse)] hover:bg-[var(--brand-hover)]",
  secondary:
    "border border-line-strong bg-surface text-ink hover:bg-surface-muted",
  ghost: "text-ink-secondary hover:bg-surface-muted hover:text-ink",
  danger:
    "bg-[var(--danger)] text-[var(--ink-inverse)] hover:brightness-95",
  subtle: "bg-brand-soft text-brand-ink hover:brightness-[0.97]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
  icon: "h-9 w-9",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={buttonClasses(variant, size, className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          icon
        )}
        {children}
      </button>
    );
  },
);
