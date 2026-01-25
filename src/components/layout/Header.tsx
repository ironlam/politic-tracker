import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { MobileMenu } from "./MobileMenu";
import { NAV_LINKS } from "@/config/navigation";
import { NavLink } from "./NavLink";

export function Header() {
  return (
    <header role="banner" className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
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
          <nav className="hidden md:flex items-center gap-1" aria-label="Navigation principale">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                activeClassName="text-foreground bg-accent"
              >
                {link.label}
              </NavLink>
            ))}
            <div className="ml-2 border-l pl-2 flex items-center gap-1">
              <Link
                href="/docs/api"
                className="px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                title="Documentation API"
              >
                API
              </Link>
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
