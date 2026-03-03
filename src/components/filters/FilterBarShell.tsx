"use client";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

interface FilterBarShellProps {
  isPending: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FilterBarShell({ isPending, children, className }: FilterBarShellProps) {
  return (
    <div className={cn("mb-6 rounded-lg border bg-muted/40 p-4 relative", className)}>
      {isPending && (
        <div className="absolute inset-0 rounded-lg bg-background/60 flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            <span>Chargement...</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
