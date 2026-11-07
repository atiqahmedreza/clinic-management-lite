import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-ink-muted ring-1 ring-inset ring-[var(--border)]">
          <FileQuestion className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          The record you are looking for may have been removed, or the link is
          out of date.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/dashboard" className={buttonClasses("primary", "md")}>
            Go to dashboard
          </Link>
          <Link href="/patients" className={buttonClasses("secondary", "md")}>
            Patient registry
          </Link>
        </div>
      </div>
    </main>
  );
}
