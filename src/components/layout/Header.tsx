import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { MobileMenu } from "./MobileMenu";
import { NavDropdown } from "./NavDropdown";
import { NAV_GROUPS, CTA_LINK } from "@/config/navigation";
import { MapPin } from "lucide-react";

export function Header() {
  return (
    <header
      role="banner"
      className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <span className="text-white font-bold text-lg">TP</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Transparence Politique
              </span>
            </div>
          </Link>

          {/* Desktop navigation */}
          <nav
            className="hidden md:flex items-center gap-1"
            aria-label="Navigation principale"
          >
            {/* Dropdown menus */}
            {NAV_GROUPS.map((group) => (
              <NavDropdown key={group.label} group={group} />
            ))}

            {/* Separator */}
            <div className="h-6 w-px bg-border mx-2" />

            {/* CTA Button - Mon député */}
            <Link
              href={CTA_LINK.href}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              <MapPin className="h-4 w-4" />
              {CTA_LINK.label}
            </Link>

            {/* Theme toggle */}
            <div className="ml-2">
              <ThemeToggle />
            </div>
          </nav>

          {/* Mobile navigation */}
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
