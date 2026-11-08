import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Table primitives. Lists render a real `<table>` from the `md` breakpoint up
 * and a stacked card list below it, so the mobile layout is genuinely usable
 * instead of a sideways-scrolling grid.
 */

export function TableWrap({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("hidden overflow-x-auto md:block", className)}>
      {children}
    </div>
  );
}

export function Table({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <table className={cn("w-full border-collapse text-sm", className)}>
      {children}
    </table>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-line bg-surface-muted">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-[var(--border)]">{children}</tbody>;
}

export function TH({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.06em] text-ink-muted",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TR({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "transition-colors duration-150 hover:bg-surface-muted/70",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  className,
  align = "left",
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "px-4 py-3.5 align-middle text-ink",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Mobile counterpart of a table row. */
export function MobileList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ul className={cn("divide-y divide-[var(--border)] md:hidden", className)}>
      {children}
    </ul>
  );
}

export function MobileRow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <li className={cn("px-4 py-3.5", className)}>{children}</li>;
}
