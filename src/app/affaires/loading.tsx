import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-9 w-72 mb-1" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
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

      {/* Affair cards */}
      <div className="space-y-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="flex items-start gap-4">
              <Skeleton className="size-12 rounded-full shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
