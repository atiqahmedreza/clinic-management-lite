import { Skeleton, StatSkeleton } from "@/components/ui/states";

export default function DashboardLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Loading the dashboard…</span>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <StatSkeleton />
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card xl:col-span-2 p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-[236px] w-full" />
        </div>
        <div className="card p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-3 w-full rounded-full" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
