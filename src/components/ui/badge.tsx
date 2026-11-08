import * as React from "react";

import { cn } from "@/lib/utils";
import {
  APPOINTMENT_STATUS_META,
  APPOINTMENT_TYPE_META,
  AVATAR_PALETTE,
  GENDER_META,
  INVOICE_STATUS_META,
  ROLE_META,
  SERVICE_CATEGORY_META,
  type Tone,
} from "@/lib/constants";
import { colorIndex, initials } from "@/lib/utils";
import type {
  AppointmentStatus,
  AppointmentType,
  Gender,
  InvoiceStatus,
  Role,
  ServiceCategory,
} from "@prisma/client";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-secondary ring-line-strong",
  info: "bg-info-soft text-info-ink ring-info/25",
  success: "bg-success-soft text-success-ink ring-success/25",
  warning: "bg-warning-soft text-warning-ink ring-warning/30",
  danger: "bg-danger-soft text-danger-ink ring-danger/25",
  accent: "bg-accent-soft text-accent-ink ring-accent/25",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot = false,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {dot ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current opacity-80"
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Domain-specific badges - one place that maps an enum to its chip.
// ---------------------------------------------------------------------------

export function AppointmentStatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  const meta = APPOINTMENT_STATUS_META[status];
  return (
    <Badge tone={meta.tone} className={className} dot>
      {meta.label}
    </Badge>
  );
}

export function AppointmentTypeBadge({ type }: { type: AppointmentType }) {
  const meta = APPOINTMENT_TYPE_META[type];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceStatus;
  className?: string;
}) {
  const meta = INVOICE_STATUS_META[status];
  return (
    <Badge tone={meta.tone} className={className} dot>
      {meta.label}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const meta = ROLE_META[role];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function GenderBadge({ gender }: { gender: Gender }) {
  const meta = GENDER_META[gender];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function ServiceCategoryBadge({
  category,
}: {
  category: ServiceCategory;
}) {
  const meta = SERVICE_CATEGORY_META[category];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const palette = AVATAR_PALETTE[colorIndex(name, AVATAR_PALETTE.length)];
  const dimensions =
    size === "sm"
      ? "h-8 w-8 text-xs"
      : size === "lg"
        ? "h-14 w-14 text-lg"
        : "h-10 w-10 text-sm";

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        palette,
        dimensions,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
