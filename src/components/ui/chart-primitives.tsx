"use client";

import * as React from "react";

/** Measures the container so charts can be drawn at real pixel widths
 *  (scaling an SVG with preserveAspectRatio would distort stroke weights). */
export function useElementWidth<T extends HTMLElement>(fallback = 640) {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(fallback);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && Math.abs(next - width) > 1) setWidth(next);
    });
    observer.observe(node);
    setWidth(node.clientWidth || fallback);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, width] as const;
}

/** Rounds an axis maximum up to a readable step. */
export function niceCeiling(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step =
    normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

export function ticksFor(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, index) => (max / count) * index);
}

/** Rounded-top bar path: flat on the baseline, 4px radius on the data end. */
export function barPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 4,
): string {
  const r = Math.min(radius, width / 2, Math.max(height, 0));
  if (height <= 0) return "";
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height}`,
    "Z",
  ].join(" ");
}

/** Floating tooltip anchored inside the chart's relative container. */
export function ChartTooltip({
  x,
  y,
  containerWidth,
  children,
}: {
  x: number;
  y: number;
  containerWidth: number;
  children: React.ReactNode;
}) {
  const WIDTH = 168;
  const left = Math.min(Math.max(x - WIDTH / 2, 4), Math.max(containerWidth - WIDTH - 4, 4));

  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]"
      style={{ left, top: Math.max(y - 12, 4), width: WIDTH }}
      role="presentation"
    >
      {children}
    </div>
  );
}

/**
 * Screen-reader / print fallback for every chart. The visualisation layer is
 * decorative; this table carries the same numbers.
 */
export function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) =>
              cellIndex === 0 ? (
                <th key={cellIndex} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={cellIndex}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Legend({
  items,
}: {
  items: { label: string; color: string; value?: string }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="text-ink-secondary">{item.label}</span>
          {item.value ? (
            <span className="tabular font-semibold text-ink">{item.value}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
