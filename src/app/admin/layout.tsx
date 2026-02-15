import Link from "next/link";
import { cookies } from "next/headers";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Check if user is authenticated (middleware handles redirect for protected routes)
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session");
  const isAuthenticated = !!session?.value;

  // For login page (which has its own layout), just render children
  // For other pages, show the full admin UI
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin header */}
      <header className="bg-slate-800 text-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link href="/admin" className="font-semibold">
                Admin
              </Link>
              <nav className="flex gap-4 text-sm">
                <Link href="/admin/affaires" className="hover:text-slate-300 transition-colors">
                  Affaires
                </Link>
                <Link
                  href="/admin/affaires/verification"
                  className="hover:text-slate-300 transition-colors"
                >
                  Vérification
                </Link>
                <Link href="/admin/politiques" className="hover:text-slate-300 transition-colors">
                  Politiques
                </Link>
                <Link href="/admin/partis" className="hover:text-slate-300 transition-colors">
                  Partis
                </Link>
                <Link href="/admin/dossiers" className="hover:text-slate-300 transition-colors">
                  Dossiers
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm text-slate-300 hover:text-white">
                Voir le site
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

function LogoutButton() {
  return (
    <form action="/api/admin/logout" method="POST">
      <button type="submit" className="text-sm text-slate-300 hover:text-white">
        Déconnexion
      </button>
    </form>
  );
}
