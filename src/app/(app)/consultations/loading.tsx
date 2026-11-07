import { Skeleton, TableSkeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-36" />
        </div>
        <TableSkeleton />
      </div>
    </div>
  );
}
