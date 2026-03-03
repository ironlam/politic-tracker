import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-9 w-64 mb-1" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Skeleton className="h-10 flex-1 min-w-[200px]" />
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
      </div>

      {/* Results count */}
      <Skeleton className="h-4 w-40 mb-4" />

      {/* Politician grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {[...Array(18)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 p-4">
            <Skeleton className="size-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
