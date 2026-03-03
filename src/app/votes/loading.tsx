import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-9 w-56 mb-1" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Skeleton className="h-10 flex-1 min-w-[200px]" />
        <div className="flex gap-2">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-32" />
          ))}
        </div>
      </div>

      {/* Results count */}
      <Skeleton className="h-4 w-40 mb-4" />

      {/* Vote list */}
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full shrink-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
