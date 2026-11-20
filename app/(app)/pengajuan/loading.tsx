import { Skeleton } from "@/components/ui/skeleton";

// Skeleton list: judul, toolbar, tabel.
export default function Loading() {
  return (
    <>
      <div className="col-span-12 flex items-end justify-between gap-3 pt-2">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="col-span-12 space-y-3 rounded-xl border bg-card p-4">
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-48" />
        </div>
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </>
  );
}
