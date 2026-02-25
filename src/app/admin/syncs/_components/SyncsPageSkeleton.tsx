import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SyncsPageSkeleton() {
  return (
    <>
      {/* Script catalog skeleton — 3 category cards */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, catIdx) => (
          <Card key={catIdx}>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="border-t border-border divide-y divide-border/60">
                {Array.from({ length: catIdx === 0 ? 5 : 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* History skeleton */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3">
                      <Skeleton className="h-4 w-12" />
                    </th>
                    <th className="px-4 py-3">
                      <Skeleton className="h-4 w-16" />
                    </th>
                    <th className="px-4 py-3">
                      <Skeleton className="h-4 w-14" />
                    </th>
                    <th className="px-4 py-3">
                      <Skeleton className="h-4 w-12" />
                    </th>
                    <th className="px-4 py-3">
                      <Skeleton className="h-4 w-20" />
                    </th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-28" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-12" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
