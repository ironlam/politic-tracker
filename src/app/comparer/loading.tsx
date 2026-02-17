import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-80" />
        {/* Mode toggle */}
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* Selectors */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div>
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
        <div>
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>

      {/* VS separator */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex-1 h-px bg-border" />
        <Skeleton className="mx-4 h-8 w-12" />
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Suggested comparisons skeleton */}
      <div className="py-8">
        <Skeleton className="h-6 w-56 mx-auto mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
