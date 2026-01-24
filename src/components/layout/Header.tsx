import Link from "next/link";

export function Header() {
  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">Transparence Politique</span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              href="/politiques"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Représentants
            </Link>
            <Link
              href="/partis"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Partis
            </Link>
            <Link
              href="/affaires"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Affaires
            </Link>
            <Link
              href="/statistiques"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Statistiques
            </Link>
            <Link
              href="/mentions-legales"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Mentions légales
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
