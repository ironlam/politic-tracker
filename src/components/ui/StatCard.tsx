import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  count: number;
  label: string;
  description?: string;
  accent: { border: string; bg: string };
  href?: string;
  isActive?: boolean;
}

export function StatCard({ count, label, description, accent, href, isActive }: StatCardProps) {
  const card = (
    <Card
      className={`border-l-4 transition-all ${
        href ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""
      } ${isActive ? "ring-2 ring-primary shadow-md" : ""}`}
      style={{
        borderLeftColor: accent.border,
        backgroundColor: isActive ? accent.bg : undefined,
      }}
    >
      <CardContent className="p-3 py-3">
        <div
          className="text-3xl font-display font-extrabold tracking-tight"
          style={{ color: accent.border }}
        >
          {count}
        </div>
        <div className="text-sm font-semibold mt-0.5 leading-tight">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">
            {description}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} prefetch={false}>
        {card}
      </Link>
    );
  }

  return card;
}
