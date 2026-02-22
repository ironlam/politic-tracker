import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { MobileMenu } from "./MobileMenu";
import { NavDropdown } from "./NavDropdown";
import { NAV_GROUPS, NAV_TOP_LEVEL, CTA_COMPARER, CTA_ASSISTANT } from "@/config/navigation";
import { GitCompare, Bot, Scale, ShieldCheck } from "lucide-react";
import { GlobalSearchTrigger } from "@/components/search";
import { getEnabledFlags } from "@/lib/feature-flags";

export async function Header() {
  const enabledFlags = await getEnabledFlags();

  // Filter nav groups: remove items gated behind disabled flags, drop empty groups
  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.featureFlag || enabledFlags.has(item.featureFlag)),
  })).filter((group) => group.items.length > 0);

  const showComparer = !CTA_COMPARER.featureFlag || enabledFlags.has(CTA_COMPARER.featureFlag);
  const showAssistant = !CTA_ASSISTANT.featureFlag || enabledFlags.has(CTA_ASSISTANT.featureFlag);

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
            {/* Top-level transparency links */}
            {NAV_TOP_LEVEL.map((item) => {
              const Icon = item.icon === "scale" ? Scale : ShieldCheck;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground hover:text-primary rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}

            {/* Dropdown menus */}
            {filteredGroups.map((group) => (
              <NavDropdown key={group.label} group={group} />
            ))}

            {/* Global search */}
            <GlobalSearchTrigger variant="desktop" />

            {/* Separator */}
            <div className="h-6 w-px bg-border mx-2" />

            {/* CTA Buttons */}
            {showComparer && (
              <Link
                href={CTA_COMPARER.href}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
              >
                <GitCompare className="h-4 w-4" />
                {CTA_COMPARER.label}
              </Link>
            )}

            {showAssistant && (
              <Link
                href={CTA_ASSISTANT.href}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Bot className="h-4 w-4" />
                {CTA_ASSISTANT.label}
              </Link>
            )}

            {/* Theme toggle */}
            <ThemeToggle />
          </nav>

          {/* Mobile navigation */}
          <MobileMenu enabledFlags={[...enabledFlags]} />
        </div>
      </div>
    </header>
  );
}
