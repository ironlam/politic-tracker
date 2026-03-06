import Image from "next/image";
import Link from "next/link";
import { MobileMenu } from "./MobileMenu";
import { NavDropdown } from "./NavDropdown";
import { NavIconBar } from "./NavIconBar";
import { NAV_GROUPS, NAV_TOP_LEVEL, NAV_TOOLS } from "@/config/navigation";
import { CalendarDays, BarChart3, ShieldCheck } from "lucide-react";
import { getEnabledFlags } from "@/lib/feature-flags";
import type { LucideIcon } from "lucide-react";

const TOP_LEVEL_ICONS: Record<string, LucideIcon> = {
  calendarDays: CalendarDays,
  barChart: BarChart3,
  shieldCheck: ShieldCheck,
};

export async function Header() {
  const enabledFlags = await getEnabledFlags();

  // Filter nav groups: remove items gated behind disabled flags, drop empty groups
  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.featureFlag || enabledFlags.has(item.featureFlag)),
  })).filter((group) => group.items.length > 0);

  // Filter top-level links by feature flags
  const filteredTopLevel = NAV_TOP_LEVEL.filter(
    (item) => !item.featureFlag || enabledFlags.has(item.featureFlag)
  );

  // Filter icon tools by feature flags
  const filteredTools = NAV_TOOLS.filter(
    (item) => !item.featureFlag || enabledFlags.has(item.featureFlag)
  );

  return (
    <header
      role="banner"
      className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/logo.svg"
              alt="Poligraph"
              width={40}
              height={40}
              className="rounded-xl group-hover:scale-105 transition-transform duration-300"
            />
            <span className="hidden sm:inline text-xl font-display font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent group-hover:from-primary group-hover:to-brand transition-all duration-300">
              Poligraph
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Navigation principale">
            {/* Top-level direct links */}
            {filteredTopLevel.map((item) => {
              const Icon = item.icon ? TOP_LEVEL_ICONS[item.icon] : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground hover:text-primary rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.label}
                </Link>
              );
            })}

            {/* Dropdown menus */}
            {filteredGroups.map((group) => (
              <NavDropdown
                key={group.label}
                group={group}
                boost={group.label === "Élections" && enabledFlags.has("ELECTIONS_BOOST")}
              />
            ))}

            {/* Separator between nav and tools */}
            <div className="h-6 w-px bg-border mx-1.5" aria-hidden="true" />

            {/* Icon tool rail */}
            <NavIconBar tools={filteredTools} />
          </nav>

          {/* Mobile navigation */}
          <MobileMenu enabledFlags={[...enabledFlags]} />
        </div>
      </div>
    </header>
  );
}
