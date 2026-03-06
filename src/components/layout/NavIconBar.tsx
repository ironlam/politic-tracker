"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Map, Newspaper, ArrowLeftRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/config/navigation";

/** Tricolor owl icon — Poligraph brand in bleu-blanc-rouge */
function OwlIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Head — bleu */}
      <ellipse cx="10" cy="8" rx="7" ry="5.5" fill="#002654" />
      {/* Ear tufts — bleu */}
      <path d="M4.5 4.5L3 1.5c1 .3 2.2 1.3 2.8 2.5z" fill="#002654" />
      <path d="M15.5 4.5L17 1.5c-1 .3-2.2 1.3-2.8 2.5z" fill="#002654" />
      {/* Body — bleu */}
      <ellipse cx="10" cy="14.5" rx="5.5" ry="5" fill="#002654" />
      {/* Belly — blanc */}
      <ellipse cx="10" cy="15.5" rx="3.5" ry="3.2" fill="white" />
      {/* Left eye — blanc + bleu iris */}
      <circle cx="7.5" cy="8" r="2.2" fill="white" />
      <circle cx="7.8" cy="7.8" r="1.2" fill="#4A9FD9" />
      <circle cx="8.1" cy="7.5" r="0.5" fill="white" />
      {/* Right eye — blanc + bleu iris */}
      <circle cx="12.5" cy="8" r="2.2" fill="white" />
      <circle cx="12.2" cy="7.8" r="1.2" fill="#4A9FD9" />
      <circle cx="11.9" cy="7.5" r="0.5" fill="white" />
      {/* Beak — rouge */}
      <path d="M10 10l-1.2 1.8h2.4z" fill="#ED2939" />
    </svg>
  );
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  map: Map,
  newspaper: Newspaper,
  telescope: OwlIcon,
  arrowLeftRight: ArrowLeftRight,
};

interface NavIconBarProps {
  /** Tool items from NAV_TOOLS (already filtered by feature flags) */
  tools: NavItem[];
}

export function NavIconBar({ tools }: NavIconBarProps) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-0.5">
      {/* Search — always present */}
      <IconLink
        href="/recherche"
        label="Rechercher sur Poligraph"
        isActive={pathname === "/recherche"}
      >
        <Search className="h-[18px] w-[18px]" aria-hidden="true" />
      </IconLink>

      {/* Divider between search and tools */}
      <div className="h-5 w-px bg-border mx-1" aria-hidden="true" />

      {/* Tool icons */}
      {tools.map((tool) => {
        const Icon = tool.icon ? ICON_MAP[tool.icon] : null;
        if (!Icon) return null;
        const isActive = pathname === tool.href || pathname.startsWith(tool.href + "/");
        return (
          <IconLink key={tool.href} href={tool.href} label={tool.label} isActive={isActive}>
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </IconLink>
        );
      })}

      {/* Divider before theme */}
      <div className="h-5 w-px bg-border mx-1" aria-hidden="true" />

      <ThemeToggle />
    </div>
  );
}

function IconLink({
  href,
  label,
  isActive,
  children,
}: {
  href: string;
  label: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
        isActive
          ? "text-primary bg-primary/10"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      title={label}
    >
      {children}
    </Link>
  );
}
