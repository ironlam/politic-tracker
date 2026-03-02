"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { COMPARE_CATEGORIES, COMPARE_CATEGORY_LABELS } from "@/types/compare";
import type { CompareCategory } from "@/types/compare";

export function CompareCategoryPicker() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const current = (searchParams.get("cat") as CompareCategory) || "deputes";

  function handleChange(cat: string) {
    if (cat === current) return;
    const params = new URLSearchParams();
    params.set("cat", cat);
    // Clear a/b selection when switching categories
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="compare-category" className="text-sm font-medium text-muted-foreground">
        Catégorie
      </label>
      <select
        id="compare-category"
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {COMPARE_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {COMPARE_CATEGORY_LABELS[cat]}
          </option>
        ))}
      </select>
    </div>
  );
}
