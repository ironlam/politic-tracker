"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Dashboard",
  affaires: "Affaires",
  politiques: "Politiques",
  partis: "Partis",
  dossiers: "Dossiers",
  elections: "Élections",
  syncs: "Syncs",
  "feature-toggles": "Feature Toggles",
  audit: "Audit Log",
  parametres: "Paramètres",
  edit: "Modifier",
  nouveau: "Nouveau",
  verification: "Vérification",
};

interface Crumb {
  label: string;
  href: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const href = "/" + segments.slice(0, i + 1).join("/");

    // Skip "admin" as first segment — it becomes "Dashboard"
    if (i === 0 && segment === "admin") {
      crumbs.push({ label: "Dashboard", href: "/admin" });
      continue;
    }

    // Known labels
    if (SEGMENT_LABELS[segment]) {
      crumbs.push({ label: SEGMENT_LABELS[segment], href });
      continue;
    }

    // Dynamic segments (IDs, slugs) — show as-is, truncated
    const label = segment.length > 20 ? segment.slice(0, 17) + "..." : segment;
    crumbs.push({ label, href });
  }

  return crumbs;
}

export function AdminBreadcrumb() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-sm">
      <Link
        href="/admin"
        className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1 rounded"
        aria-label="Dashboard"
      >
        <Home className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>

      {crumbs.slice(1).map((crumb, i) => {
        const isLast = i === crumbs.length - 2;

        return (
          <span key={crumb.href} className="flex items-center gap-1">
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" aria-hidden="true" />
            {isLast ? (
              <span className="font-medium text-foreground" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
