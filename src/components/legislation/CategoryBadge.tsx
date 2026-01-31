import { Badge } from "@/components/ui/badge";
import { DOSSIER_CATEGORY_COLORS, DOSSIER_CATEGORY_ICONS } from "@/config/labels";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  category: string | null | undefined;
  className?: string;
  showIcon?: boolean;
}

export function CategoryBadge({ category, className, showIcon = true }: CategoryBadgeProps) {
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
