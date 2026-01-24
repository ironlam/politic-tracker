import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { MobileMenu } from "./MobileMenu";

const NAV_LINKS = [
  { href: "/mon-depute", label: "Mon député" },
  { href: "/politiques", label: "Représentants" },
  { href: "/departements", label: "Départements" },
  { href: "/partis", label: "Partis" },
  { href: "/affaires", label: "Affaires" },
  { href: "/statistiques", label: "Statistiques" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
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
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="ml-2 border-l pl-2">
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
