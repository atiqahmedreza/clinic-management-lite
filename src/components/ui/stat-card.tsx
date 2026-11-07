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
  const accents = {
    brand: "bg-brand-soft text-brand-ink",
    amber:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  } as const;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-secondary">{label}</p>
        {icon ? (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              accents[accent],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>

      <p className="tabular mt-2.5 text-2xl font-semibold tracking-tight text-ink">
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
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {positive ? "+" : ""}
      {change.toFixed(1)}%
    </span>
  );
}
