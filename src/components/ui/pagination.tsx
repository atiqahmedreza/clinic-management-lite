import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buildQuery, cn, type SearchParamsInput } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  basePath,
  searchParams,
  label = "records",
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  basePath: string;
  searchParams: SearchParamsInput;
  label?: string;
}) {
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  const pages = pageWindow(page, pageCount);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row"
    >
      <p className="text-sm text-ink-muted">
        Showing <span className="font-medium text-ink">{first}</span>–
        <span className="font-medium text-ink">{last}</span> of{" "}
        <span className="font-medium text-ink">{total}</span> {label}
      </p>

      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <PageLink
            href={`${basePath}${buildQuery(searchParams, { page: page - 1 })}`}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </PageLink>

          {pages.map((item, index) =>
            item === "gap" ? (
              <span
                key={`gap-${index}`}
                className="px-1.5 text-sm text-ink-muted"
              >
                …
              </span>
            ) : (
              <PageLink
                key={item}
                href={`${basePath}${buildQuery(searchParams, { page: item })}`}
                active={item === page}
                aria-label={`Page ${item}`}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </PageLink>
            ),
          )}

          <PageLink
            href={`${basePath}${buildQuery(searchParams, { page: page + 1 })}`}
            disabled={page >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </PageLink>
        </div>
      ) : null}
    </nav>
  );
}

function PageLink({
  href,
  active,
  disabled,
  children,
  ...props
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const className = cn(
    "inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-control)] px-2 text-sm font-medium tabular transition-colors duration-150",
    active
      ? "bg-[var(--brand)] text-[var(--ink-inverse)]"
      : "text-ink-secondary hover:bg-surface-muted",
    disabled && "pointer-events-none opacity-40",
  );

  if (disabled) {
    return (
      <span className={className} aria-disabled {...props}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={className} {...props}>
      {children}
    </Link>
  );
}

/** 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const items: (number | "gap")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) items.push("gap");
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < pageCount - 1) items.push("gap");
  items.push(pageCount);

  return items;
}
