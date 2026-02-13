import { Badge } from "@/components/ui/badge";
import { DOSSIER_STATUS_LABELS, DOSSIER_STATUS_COLORS } from "@/config/labels";
import type { DossierStatus } from "@/generated/prisma";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: DossierStatus;
  className?: string;
  showIcon?: boolean;
}

const STATUS_ICONS: Record<DossierStatus, string> = {
  DEPOSE: "📋",
  EN_COMMISSION: "🔍",
  EN_COURS: "🔴",
  CONSEIL_CONSTITUTIONNEL: "⚖️",
  ADOPTE: "✅",
  REJETE: "❌",
  RETIRE: "⏸️",
  CADUQUE: "🕐",
};

export function StatusBadge({ status, className, showIcon = false }: StatusBadgeProps) {
  return (
    <Badge className={cn(DOSSIER_STATUS_COLORS[status], className)}>
      {showIcon && <span className="mr-1">{STATUS_ICONS[status]}</span>}
      {DOSSIER_STATUS_LABELS[status]}
    </Badge>
  );
}
