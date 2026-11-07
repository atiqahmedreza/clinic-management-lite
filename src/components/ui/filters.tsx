"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { controlBase } from "@/components/ui/field";

/**
 * Filter controls write their state into the URL, so every filtered list is
 * shareable, survives a refresh and is rendered on the server.
 */
function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return React.useCallback(
    (changes: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === "") params.delete(key);
        else params.set(key, value);
      }
      // Any filter change resets paging.
      params.delete("page");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );
}

export function SearchInput({
  placeholder = "Search…",
  paramName = "q",
  className,
  label = "Search",
}: {
  placeholder?: string;
  paramName?: string;
  className?: string;
  label?: string;
}) {
  const searchParams = useSearchParams();
  const update = useQueryUpdater();
  const [value, setValue] = React.useState(
    searchParams.get(paramName) ?? "",
  );
  const [isPending, startTransition] = React.useTransition();
  const inputId = React.useId();

  // Keep the box in step when the URL changes from elsewhere (e.g. back).
  const urlValue = searchParams.get(paramName) ?? "";
  React.useEffect(() => {
    setValue((current) => (current === urlValue ? current : urlValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlValue]);

  React.useEffect(() => {
    if (value === urlValue) return;
    const timer = window.setTimeout(() => {
      startTransition(() => update({ [paramName]: value || undefined }));
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative min-w-0 flex-1 sm:max-w-sm", className)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        aria-hidden
      />
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className={cn(controlBase, "h-10 pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden")}
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-ink-muted" aria-hidden />
        ) : value ? (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear search"
            className="rounded p-0.5 text-ink-muted transition-colors hover:text-ink"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </span>
    </div>
  );
}

export function FilterSelect({
  paramName,
  label,
  options,
  allLabel = "All",
  className,
}: {
  paramName: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  className?: string;
}) {
  const searchParams = useSearchParams();
  const update = useQueryUpdater();
  const [, startTransition] = React.useTransition();
  const id = React.useId();
  const current = searchParams.get(paramName) ?? "";

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={current}
        onChange={(event) =>
          startTransition(() =>
            update({ [paramName]: event.target.value || undefined }),
          )
        }
        className={cn(
          controlBase,
          "h-10 cursor-pointer appearance-none pr-9",
          current && "border-[var(--brand)] text-brand-ink",
        )}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
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
}

export function DateFilter({
  paramName,
  label,
  className,
}: {
  paramName: string;
  label: string;
  className?: string;
}) {
  const searchParams = useSearchParams();
  const update = useQueryUpdater();
  const [, startTransition] = React.useTransition();
  const id = React.useId();

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={searchParams.get(paramName) ?? ""}
        onChange={(event) =>
          startTransition(() =>
            update({ [paramName]: event.target.value || undefined }),
          )
        }
        className={cn(controlBase, "h-10")}
        aria-label={label}
      />
    </div>
  );
}

export function ClearFilters({ keys }: { keys: string[] }) {
  const searchParams = useSearchParams();
  const update = useQueryUpdater();
  const active = keys.some((key) => searchParams.get(key));

  if (!active) return null;

  return (
    <button
      type="button"
      onClick={() =>
        update(Object.fromEntries(keys.map((key) => [key, undefined])))
      }
      className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink"
    >
      <X className="h-3.5 w-3.5" aria-hidden />
      Clear filters
    </button>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
    </div>
  );
}
