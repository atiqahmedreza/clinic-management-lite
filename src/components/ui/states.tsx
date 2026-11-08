import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-ink-muted ring-1 ring-inset ring-[var(--border)]">
          {icon}
        </span>
      ) : null}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

type AlertVariant = "info" | "success" | "warning" | "error";

const alertStyles: Record<
  AlertVariant,
  { wrap: string; icon: React.ElementType }
> = {
  info: {
    wrap: "border-info/25 bg-info-soft text-info-ink",
    icon: Info,
  },
  success: {
    wrap: "border-success/25 bg-success-soft text-success-ink",
    icon: CheckCircle2,
  },
  warning: {
    wrap: "border-warning/30 bg-warning-soft text-warning-ink",
    icon: AlertTriangle,
  },
  error: {
    wrap: "border-danger/25 bg-danger-soft text-danger-ink",
    icon: XCircle,
  },
};

export function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: AlertVariant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const style = alertStyles[variant];
  const Icon = style.icon;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        style.wrap,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-[var(--radius-control)]", className)} aria-hidden />;
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[var(--border)]" aria-busy="true">
      <span className="sr-only">Loading records…</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-3.5 w-24 sm:block" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-3 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page-level error panel (used by error.tsx boundaries)
// ---------------------------------------------------------------------------

export function ErrorPanel({
  title = "Something went wrong",
  message,
  onRetry,
  homeHref = "/dashboard",
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  homeHref?: string;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="mt-1.5 max-w-md text-sm text-ink-muted">
        {message ??
          "The page could not be loaded. This is usually temporary — try again in a moment."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {onRetry ? (
          <button onClick={onRetry} className={buttonClasses("primary", "md")}>
            Try again
          </button>
        ) : null}
        <Link href={homeHref} className={buttonClasses("secondary", "md")}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
