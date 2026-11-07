"use client";

import * as React from "react";

import { formatCurrency, formatCurrencyCompact, formatNumber } from "@/lib/utils";
import {
  barPath,
  ChartDataTable,
  ChartTooltip,
  Legend,
  niceCeiling,
  ticksFor,
  useElementWidth,
} from "@/components/ui/chart-primitives";

/* ===========================================================================
   Shared geometry
   =========================================================================== */

const PAD = { top: 14, right: 10, bottom: 26, left: 52 };

function useSvgTheme() {
  // Reading the CSS custom properties keeps the SVG in step with the theme
  // toggle without duplicating hex values in JavaScript.
  return {
    grid: "var(--viz-grid)",
    axis: "var(--viz-axis)",
    label: "var(--viz-label)",
    series1: "var(--viz-1)",
    series2: "var(--viz-2)",
    series3: "var(--viz-3)",
    surface: "var(--surface)",
  };
}

/* ===========================================================================
   Revenue trend - single series, area + line, crosshair tooltip
   =========================================================================== */

export type TrendPoint = {
  label: string;
  revenue: number;
  appointments: number;
  completed: number;
};

export function RevenueTrendChart({
  data,
  height = 236,
}: {
  data: TrendPoint[];
  height?: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const theme = useSvgTheme();
  const gradientId = React.useId();
  const [active, setActive] = React.useState<number | null>(null);

  const plotWidth = Math.max(width - PAD.left - PAD.right, 10);
  const plotHeight = height - PAD.top - PAD.bottom;

  const max = niceCeiling(Math.max(...data.map((d) => d.revenue), 1));
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const pointAt = (index: number, value: number) => ({
    x: PAD.left + index * stepX,
    y: PAD.top + plotHeight - (value / max) * plotHeight,
  });

  const points = data.map((item, index) => pointAt(index, item.revenue));
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${PAD.top + plotHeight} L ${points[0].x} ${PAD.top + plotHeight} Z`
      : "";

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left - PAD.left;
    const index = Math.round(x / (stepX || 1));
    setActive(Math.min(Math.max(index, 0), data.length - 1));
  };

  const activePoint = active !== null ? points[active] : null;
  const activeDatum = active !== null ? data[active] : null;

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Payments collected per day over the last 14 days"
        onMouseMove={onMove}
        onMouseLeave={() => setActive(null)}
        className="touch-none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--viz-area-from)" />
            <stop offset="100%" stopColor="var(--viz-area-to)" />
          </linearGradient>
        </defs>

        {/* gridlines + y ticks */}
        {ticksFor(max).map((tick) => {
          const y = PAD.top + plotHeight - (tick / max) * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y}
                y2={y}
                stroke={theme.grid}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y + 3.5}
                textAnchor="end"
                fontSize={10.5}
                fill={theme.label}
                className="tabular"
              >
                {formatCurrencyCompact(tick)}
              </text>
            </g>
          );
        })}

        {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke={theme.series1}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* x labels - every third tick keeps them from colliding */}
        {data.map((item, index) =>
          index % 3 === 0 || index === data.length - 1 ? (
            <text
              key={item.label}
              x={PAD.left + index * stepX}
              y={height - 8}
              textAnchor={
                index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"
              }
              fontSize={10.5}
              fill={theme.label}
            >
              {item.label}
            </text>
          ) : null,
        )}

        {activePoint ? (
          <g>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={PAD.top}
              y2={PAD.top + plotHeight}
              stroke={theme.axis}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r={5}
              fill={theme.series1}
              stroke={theme.surface}
              strokeWidth={2}
            />
          </g>
        ) : null}
      </svg>

      {activePoint && activeDatum ? (
        <ChartTooltip
          x={activePoint.x}
          y={activePoint.y}
          containerWidth={width}
        >
          <p className="font-semibold text-ink">{activeDatum.label}</p>
          <p className="mt-1 flex items-center justify-between gap-2 text-ink-secondary">
            <span>Collected</span>
            <span className="tabular font-semibold text-ink">
              {formatCurrency(activeDatum.revenue)}
            </span>
          </p>
          <p className="flex items-center justify-between gap-2 text-ink-secondary">
            <span>Visits</span>
            <span className="tabular font-semibold text-ink">
              {activeDatum.appointments}
            </span>
          </p>
        </ChartTooltip>
      ) : null}

      <ChartDataTable
        caption="Payments collected per day over the last 14 days"
        columns={["Day", "Collected", "Appointments"]}
        rows={data.map((item) => [
          item.label,
          formatCurrency(item.revenue),
          item.appointments,
        ])}
      />
    </div>
  );
}

/* ===========================================================================
   Visits per day - stacked bars (completed / still open), legend + tooltip
   =========================================================================== */

export function VisitsBarChart({
  data,
  height = 236,
}: {
  data: TrendPoint[];
  height?: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const theme = useSvgTheme();
  const [active, setActive] = React.useState<number | null>(null);

  const plotWidth = Math.max(width - PAD.left - PAD.right, 10);
  const plotHeight = height - PAD.top - PAD.bottom;

  const max = niceCeiling(Math.max(...data.map((d) => d.appointments), 1));
  const slot = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.max(Math.min(slot - 8, 26), 6);

  const scale = (value: number) => (value / max) * plotHeight;

  return (
    <div ref={ref} className="w-full">
      <div className="mb-3">
        <Legend
          items={[
            { label: "Completed", color: "var(--viz-3)" },
            { label: "Other outcome", color: "var(--viz-1)" },
          ]}
        />
      </div>

      <div className="relative">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Appointments per day over the last 14 days, split by completed and other outcomes"
          onMouseLeave={() => setActive(null)}
        >
          {ticksFor(max).map((tick) => {
            const y = PAD.top + plotHeight - scale(tick);
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y}
                  y2={y}
                  stroke={theme.grid}
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize={10.5}
                  fill={theme.label}
                  className="tabular"
                >
                  {Math.round(tick)}
                </text>
              </g>
            );
          })}

          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={PAD.top + plotHeight}
            y2={PAD.top + plotHeight}
            stroke={theme.axis}
            strokeWidth={1}
          />

          {data.map((item, index) => {
            const x = PAD.left + index * slot + (slot - barWidth) / 2;
            const completedHeight = scale(item.completed);
            const otherHeight = scale(
              Math.max(item.appointments - item.completed, 0),
            );
            const baseY = PAD.top + plotHeight;

            // 2px surface gap between the two segments.
            const gap = completedHeight > 0 && otherHeight > 0 ? 2 : 0;

            return (
              <g
                key={item.label}
                onMouseEnter={() => setActive(index)}
                style={{ cursor: "default" }}
              >
                {/* generous hit area */}
                <rect
                  x={PAD.left + index * slot}
                  y={PAD.top}
                  width={slot}
                  height={plotHeight}
                  fill="transparent"
                />
                {completedHeight > 0 ? (
                  <path
                    d={barPath(
                      x,
                      baseY - completedHeight,
                      barWidth,
                      completedHeight,
                      otherHeight > 0 ? 0 : 4,
                    )}
                    fill="var(--viz-3)"
                    opacity={active === null || active === index ? 1 : 0.45}
                  />
                ) : null}
                {otherHeight > 0 ? (
                  <path
                    d={barPath(
                      x,
                      baseY - completedHeight - gap - otherHeight,
                      barWidth,
                      otherHeight,
                      4,
                    )}
                    fill="var(--viz-1)"
                    opacity={active === null || active === index ? 1 : 0.45}
                  />
                ) : null}
              </g>
            );
          })}

          {data.map((item, index) =>
            index % 3 === 0 || index === data.length - 1 ? (
              <text
                key={item.label}
                x={PAD.left + index * slot + slot / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize={10.5}
                fill={theme.label}
              >
                {item.label}
              </text>
            ) : null,
          )}
        </svg>

        {active !== null && data[active] ? (
          <ChartTooltip
            x={PAD.left + active * slot + slot / 2}
            y={PAD.top}
            containerWidth={width}
          >
            <p className="font-semibold text-ink">{data[active].label}</p>
            <p className="mt-1 flex items-center justify-between gap-2 text-ink-secondary">
              <span>Booked</span>
              <span className="tabular font-semibold text-ink">
                {data[active].appointments}
              </span>
            </p>
            <p className="flex items-center justify-between gap-2 text-ink-secondary">
              <span>Completed</span>
              <span className="tabular font-semibold text-ink">
                {data[active].completed}
              </span>
            </p>
          </ChartTooltip>
        ) : null}
      </div>

      <ChartDataTable
        caption="Appointments per day over the last 14 days"
        columns={["Day", "Booked", "Completed"]}
        rows={data.map((item) => [
          item.label,
          item.appointments,
          item.completed,
        ])}
      />
    </div>
  );
}

/* ===========================================================================
   Today's status - part-to-whole segmented bar with a counted legend
   (the legend doubles as the direct labels the contrast relief rule requires)
   =========================================================================== */

export type StatusSlice = {
  label: string;
  value: number;
  color: string;
};

export function StatusSegmentedBar({ slices }: { slices: StatusSlice[] }) {
  const visible = slices.filter((slice) => slice.value > 0);
  const total = visible.reduce((sum, slice) => sum + slice.value, 0);

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-muted">
        No appointments booked for today yet.
      </p>
    );
  }

  return (
    <div className="space-y-3.5">
      <div
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={visible
          .map((slice) => `${slice.label}: ${slice.value}`)
          .join(", ")}
      >
        {visible.map((slice) => (
          <span
            key={slice.label}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(slice.value / total) * 100}%`,
              backgroundColor: slice.color,
            }}
          />
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
        {slices.map((slice) => (
          <li
            key={slice.label}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: slice.color }}
                aria-hidden
              />
              <span className="truncate text-ink-secondary">{slice.label}</span>
            </span>
            <span className="tabular font-semibold text-ink">
              {formatNumber(slice.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ===========================================================================
   Horizontal ranking bars - "busiest doctors this month"
   =========================================================================== */

export function RankingBars({
  items,
}: {
  items: { label: string; sublabel?: string; value: number }[];
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-medium text-ink">
              {item.label}
              {item.sublabel ? (
                <span className="ml-1.5 text-xs font-normal text-ink-muted">
                  {item.sublabel}
                </span>
              ) : null}
            </span>
            <span className="tabular shrink-0 text-sm font-semibold text-ink">
              {item.value}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((item.value / max) * 100, 4)}%`,
                backgroundColor: "var(--viz-1)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
