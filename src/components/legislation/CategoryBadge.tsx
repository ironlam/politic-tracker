import { Badge } from "@/components/ui/badge";
import {
  DOSSIER_CATEGORY_COLORS,
  DOSSIER_CATEGORY_ICONS,
  THEME_CATEGORY_COLORS,
  THEME_CATEGORY_LABELS,
  THEME_CATEGORY_ICONS,
} from "@/config/labels";
import { cn } from "@/lib/utils";
import type { ThemeCategory } from "@/types";

interface CategoryBadgeProps {
  category?: string | null;
  theme?: ThemeCategory | null;
  className?: string;
  showIcon?: boolean;
}

export function CategoryBadge({ category, theme, className, showIcon = true }: CategoryBadgeProps) {
  // Theme takes priority over legacy category
  if (theme) {
    const colorClass = THEME_CATEGORY_COLORS[theme];
    const icon = THEME_CATEGORY_ICONS[theme];
    const label = THEME_CATEGORY_LABELS[theme];

    return (
      <Badge variant="outline" className={cn(colorClass, className)}>
        {showIcon && <span className="mr-1">{icon}</span>}
        {label}
      </Badge>
    );
  }

  if (!category) return null;

  const colorClass = DOSSIER_CATEGORY_COLORS[category] || "bg-gray-100 text-gray-800";
  const icon = DOSSIER_CATEGORY_ICONS[category] || "📄";

  return (
    <Badge variant="outline" className={cn(colorClass, className)}>
      {showIcon && <span className="mr-1">{icon}</span>}
      {category}
    </Badge>
  );
}
