import { Skeleton } from "@/components/ui/skeleton";

// Skeleton berbentuk layout (bukan spinner satu halaman). Halaman list punya loading.tsx sendiri.
export default function Loading() {
  return (
    <>
      <div className="col-span-12 space-y-2 pt-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="col-span-12 h-28 rounded-xl lg:col-span-6" />
      <Skeleton className="col-span-12 h-28 rounded-xl lg:col-span-6" />
      <Skeleton className="col-span-12 h-64 rounded-xl" />
    </>
  );
}
