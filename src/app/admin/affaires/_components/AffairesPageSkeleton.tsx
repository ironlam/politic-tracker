import { Skeleton } from "@/components/ui/skeleton";

export function AffairesPageSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 w-10">
              <Skeleton className="h-4 w-4" />
            </th>
            <th className="px-4 py-3">
              <Skeleton className="h-4 w-20" />
            </th>
            <th className="px-4 py-3">
              <Skeleton className="h-4 w-16" />
            </th>
            <th className="px-4 py-3">
              <Skeleton className="h-4 w-20" />
            </th>
            <th className="px-4 py-3">
              <Skeleton className="h-4 w-28" />
            </th>
            <th className="px-4 py-3">
              <Skeleton className="h-4 w-24" />
            </th>
            <th className="px-4 py-3">
              <Skeleton className="h-4 w-16" />
            </th>
            <th className="px-4 py-3">
              <Skeleton className="h-4 w-16" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3">
                <Skeleton className="h-4 w-4" />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </td>
              <td className="px-4 py-3">
                <Skeleton className="h-4 w-40" />
              </td>
              <td className="px-4 py-3">
                <Skeleton className="h-4 w-24" />
              </td>
              <td className="px-4 py-3">
                <Skeleton className="h-5 w-20 rounded-full" />
              </td>
              <td className="px-4 py-3">
                <Skeleton className="h-5 w-16 rounded-full" />
              </td>
              <td className="px-4 py-3">
                <Skeleton className="h-4 w-6" />
              </td>
              <td className="px-4 py-3">
                <Skeleton className="h-4 w-16" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
