"use client";

import { useEffect } from "react";

import { ErrorPanel } from "@/components/ui/states";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl p-6">
      <ErrorPanel
        title="This page could not be loaded"
        message={
          error.message.includes("DATABASE_URL") ||
          error.message.toLowerCase().includes("connect")
            ? "The application cannot reach the database. Check that DATABASE_URL is set and the database is reachable."
            : "Something went wrong while loading this page. Trying again usually fixes it."
        }
        onRetry={reset}
      />
      {error.digest ? (
        <p className="mt-3 text-center text-xs text-ink-muted">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
