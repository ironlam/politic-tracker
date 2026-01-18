import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Skip auth check for login page
  const isLoginPage =
    typeof window === "undefined"
      ? false
      : window.location.pathname === "/admin/login";

  if (!isLoginPage) {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      redirect("/admin/login");
    }
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
                <Link
                  href="/admin/affaires"
                  className="hover:text-slate-300 transition-colors"
                >
                  Affaires
                </Link>
                <Link
                  href="/admin/politiques"
                  className="hover:text-slate-300 transition-colors"
                >
                  Politiques
                </Link>
                <Link
                  href="/admin/partis"
                  className="hover:text-slate-300 transition-colors"
                >
                  Partis
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm text-slate-300 hover:text-white"
              >
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
      <button
        type="submit"
        className="text-sm text-slate-300 hover:text-white"
      >
        Déconnexion
      </button>
    </form>
  );
}
