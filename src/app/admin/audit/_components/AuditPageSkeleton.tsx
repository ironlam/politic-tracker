import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AuditPageSkeleton() {
  return (
    <div className="relative" role="list" aria-label="Chargement du journal d'audit">
      {/* Vertical thread line */}
      <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border" aria-hidden="true" />

      <div className="space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="relative pl-12" role="listitem">
            {/* Timeline dot */}
            <Skeleton className="absolute left-3 top-4 w-3.5 h-3.5 rounded-full" />

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="mt-0.5 h-5 w-5 rounded" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-5 w-24 rounded" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
