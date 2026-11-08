import * as React from "react";
import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A stat tile is the right form for a single headline number - no plot, no
 * legend. A delta is shown with an arrow plus a sign so the meaning never
 * rests on colour alone.
 */
export function StatCard({
  label,
  value,
  sublabel,
  icon,
  change,
  changeLabel,
  href,
  accent = "brand",
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  icon?: React.ReactNode;
  /** Percentage change vs the previous period. `null` means "no baseline". */
  change?: number | null;
  changeLabel?: string;
  href?: string;
  accent?: "brand" | "amber" | "rose" | "sky";
}) {
  /* The four call-sites keep their names; the tints are warm now. */
  const accents = {
    brand: "bg-brand-soft text-brand-ink",
    amber: "bg-warning-soft text-warning-ink",
    rose: "bg-danger-soft text-danger-ink",
    sky: "bg-info-soft text-info-ink",
  } as const;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {icon ? (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              accents[accent],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>

      <p className="display tabular mt-2.5 text-[1.75rem] text-ink">
        {value}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {typeof change === "number" ? <DeltaChip change={change} /> : null}
        {sublabel ? (
          <span className="text-ink-muted">{sublabel}</span>
        ) : changeLabel ? (
          <span className="text-ink-muted">{changeLabel}</span>
        ) : null}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="card group relative p-5 transition-colors hover:border-line-strong"
      >
        {body}
        <ArrowRight
          className="absolute right-5 bottom-5 h-4 w-4 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </Link>
    );
  }

  return <div className="card p-5">{body}</div>;
}

function DeltaChip({ change }: { change: number }) {
  const positive = change >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium",
        positive
          ? "bg-success-soft text-success-ink"
          : "bg-danger-soft text-danger-ink",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {positive ? "+" : ""}
      {change.toFixed(1)}%
    </span>
  );
}
