"use client";

import { DebouncedSearchInput } from "@/components/filters";
import { useFilterParams } from "@/hooks/useFilterParams";

export function PresseSearchInput({ value }: { value: string }) {
  const { updateParams } = useFilterParams();
  return (
    <DebouncedSearchInput
      value={value}
      onSearch={(v) => updateParams({ search: v })}
      placeholder="Rechercher un article..."
      className="flex-1 min-w-[200px]"
    />
  );
}
